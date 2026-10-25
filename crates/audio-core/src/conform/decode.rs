//! Source decoding: WAV via `hound`, everything else via Symphonia.

use std::path::Path;

/// Decode a WAV file to interleaved f32 samples.
///
/// Handles integer PCM (8/16/24/32-bit) as well as 32-bit float WAVs.
/// Integer samples are scaled to `[-1, 1]`; 24-bit samples are divided by
/// `8_388_607`, the mirror of the PCM24 write scale used by
/// [`crate::conform::write_pcm24_wav`], so a written full-scale `1.0` reads
/// back as exactly `1.0`.
///
/// Returns `(interleaved samples, channels, sample_rate)`.
pub fn decode_wav_to_f32(path: &str) -> Result<(Vec<f32>, u16, u32), String> {
    use hound::SampleFormat;

    let mut reader = hound::WavReader::open(path).map_err(|e| format!("Failed to open WAV: {}", e))?;

    let spec = reader.spec();
    let channels = spec.channels;
    let sample_rate = spec.sample_rate;

    let mut samples = Vec::new();

    match spec.sample_format {
        SampleFormat::Float => {
            for result in reader.samples::<f32>() {
                samples.push(result.map_err(|e| format!("WAV sample error: {}", e))?);
            }
        }
        SampleFormat::Int => {
            // `bits_per_sample` decides how hound widens the stored integers;
            // scale by the corresponding full-scale value.
            let scale = match spec.bits_per_sample {
                8 => 128.0f32,
                16 => 32_768.0f32,
                // Mirror of the writer: round(s * 8_388_607) / 8_388_607.
                24 => 8_388_607.0f32,
                32 => 2_147_483_648.0f32,
                bits => return Err(format!("Unsupported WAV bit depth: {}", bits)),
            };
            for result in reader.samples::<i32>() {
                let s = result.map_err(|e| format!("WAV sample error: {}", e))?;
                samples.push(s as f32 / scale);
            }
        }
    }

    Ok((samples, channels, sample_rate))
}

/// Decode a compressed/lossless source file (flac/mp3/m4a/aac/...) to
/// interleaved f32 samples using Symphonia's content probe.
///
/// Returns `(interleaved samples, channels, sample_rate)`.
pub fn decode_with_symphonia(path: &str) -> Result<(Vec<f32>, u16, u32), String> {
    use symphonia::core::codecs::DecoderOptions;
    use symphonia::core::errors::Error as SymphoniaError;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;

    let file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open '{}': {}", path, e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = Path::new(path).extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| format!("Unsupported or unrecognized audio file '{}': {}", path, e))?;
    let mut format = probed.format;

    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL)
        .ok_or_else(|| format!("No audio track found in '{}'", path))?;
    let track_id = track.id;

    let codec_params = track.codec_params.clone();
    let sample_rate = codec_params
        .sample_rate
        .ok_or_else(|| format!("Unknown sample rate for '{}'", path))?;

    let mut decoder = symphonia::default::get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Failed to create decoder: {}", e))?;

    let mut channels: u16 = codec_params
        .channels
        .map(|c| c.count() as u16)
        .unwrap_or(0);
    let mut samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(SymphoniaError::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break
            }
            Err(SymphoniaError::ResetRequired) => break,
            Err(e) => return Err(format!("Container read error: {}", e)),
        };
        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            // Skip corrupt frames instead of aborting the whole import.
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(e) => return Err(format!("Decode error: {}", e)),
        };

        let frames = decoded.frames();
        if frames == 0 {
            continue;
        }
        if channels == 0 {
            channels = decoded.spec().channels.count() as u16;
        }

        // Convert to f32 planes and interleave them into the output buffer.
        let mut fbuf = decoded.make_equivalent::<f32>();
        decoded.convert(&mut fbuf);
        let planes = fbuf.planes();
        let planes = planes.planes();
        for f in 0..frames {
            for plane in planes {
                samples.push(plane[f]);
            }
        }
    }

    if samples.is_empty() {
        return Err(format!("No audio decoded from '{}'", path));
    }

    Ok((samples, channels.max(1), sample_rate))
}

/// Decode any supported source file to interleaved f32 samples.
///
/// Routing: `.wav` files go through `hound` (integer PCM + float), every
/// other extension is probed and decoded by Symphonia.
///
/// Returns `(interleaved samples, channels, sample_rate)`.
pub fn decode_source(path: &str) -> Result<(Vec<f32>, u16, u32), String> {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match ext.as_str() {
        "wav" | "wave" => decode_wav_to_f32(path),
        _ => decode_with_symphonia(path),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Decode a hex string into bytes (test fixture helper).
    fn unhex(hex: &str) -> Vec<u8> {
        let bytes = hex.as_bytes();
        bytes
            .chunks_exact(2)
            .map(|pair| {
                let hi = (pair[0] as char).to_digit(16).unwrap() as u8;
                let lo = (pair[1] as char).to_digit(16).unwrap() as u8;
                (hi << 4) | lo
            })
            .collect()
    }

    fn temp_path(name: &str) -> String {
        let dir = std::env::temp_dir().join(format!("audio-core-decode-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name).to_string_lossy().into_owned()
    }

    #[test]
    fn test_decode_source_missing_file() {
        let err = decode_source("/nonexistent/definitely-missing.wav");
        assert!(err.is_err());
    }

    /// A 0.5s / 440 Hz mono MP3 embedded as hex so the test needs no
    /// external tooling. Exercises the Symphonia content-probe path.
    const TONE_MP3_HEX: &str = concat!(
        "49443304000000000022545353450000000e0000034c61766636332e312e3130320000000000000000000000fffb40c0",
        "000000000000000000000000000000000058696e670000000f0000001500000afa00404040404b4b4b4b4b5555555555",
        "5e5e5e5e5e6868686871717171717b7b7b7b7b84848484848e8e8e8e9797979797a1a1a1a1a1aaaaaaaaaab4b4b4b4bd",
        "bdbdbdbdc7c7c7c7c7d0d0d0d0d0dadadadae3e3e3e3e3edededededf6f6f6f6f6ffffffff000000004c61766336332e",
        "312e00000000000000000000000024061e0000000000000afa2dcad1e80000000000fffba0c400000360135df4300028",
        "bf88adff30720000000113568e00000000c0dcd00000004270f1e3f50000035d0f0f024020aba800800600e000000000",
        "0002244aaf5b5c7095ee4d43df2f0178b2d3dfdf05a037c068f0dbf1e129dea0684aca0398a00000000052a74b6a4386",
        "7874b292d4395cae7db60797a0000e00bc40d0e423a08e66b0aebfaa4c414d45342e30aaaaaaaaaaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaafc05fcf00000000032249d0e383c032a8690a22112eed81e5e8000201a004f03a082e22182f2a2cf4c414d",
        "45342e30aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaafc05fcf00000000031",
        "251c875a2b06360ca2424426cca02bac00009a046085c0a84740accd615d7f554c414d45342e30555555555555555555",
        "5555555555555555555555555555555555555555555555555555fc06fdf00000000032249d07382826d50b21260a8977",
        "680eeb4000202d609781314973a158fd48c1b54c414d45342e3055555555555555555555555555555555555555555555",
        "55555555555555555555555555fc05fbe000000000248e45505a417032e0a9332884d9940775a0001ee2f265c2529e87",
        "5abd008c8f154c414d45342e305555555555555555555555555555555555555555555555555555555555555555555555",
        "5555fc05ece00000000032249d0738280faa74ebc627bf9403538000fffb20c4d500c2dc1b67dcf000204983adf83630",
        "0c188d0027409861e18205ca20d54c414d45342e30555555555555555555555555555555555555555555555555555555",
        "55555555555555555555fc06fce000000000311c8e455a2b0336109a6498d65c80d4e80007b8f985c2519f13cecc160f",
        "0a4c414d45342e30aaaaaaaaaaaafffb10c4ea00c2b41d73c62526204983adf834b004aaaaaaaaaaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaafc06fce000000000321c4e85302c0355212978f54fe4004c60000282dc33",
        "a0030c3c987078804b4c414d45342e30aaaaaaaaaaaafffb10c4ea80c2b01d73c63122604a83ad7896304caaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaafc06ece000000000311c928aa45e0e5c32f6498d66c80d",
        "4e80003c48f932e08867c239da836238554c414d45342e30555555555555fffb10c4ea80c2b81d73c63d24204b03adb8",
        "663c0c55555555555555555555555555555555555555555555555555555555555555fc06fce000000000321c530a6058",
        "15544e44f1ea9fd901a9d0000447b87f406c30f261c1e2012d4c414d45342e30555555555555fffb10c4ea80c2bc1d71",
        "c62d22604983adb8c7a48c55555555555555555555555555555555555555555555555555555555555555fc06ece00000",
        "00000a80c5d07b42f0a6c4346a4f8dbb6406e6c0001218984788a33e0accd84eda4c414d45342e30aaaaaaaaaaaafffb",
        "10c4e980c29c1d73c63182204683ad7896244caaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "aaaafb08fde000000000321e53107068172829058342533bb2037360000c8fb04fc230c3c28306d2314c414d45342e30",
        "555555555555fffb10c4e980c2a41d73c63122604503ad78c6188c555555555555555555555555555555555555555555",
        "555555555555555555fb08fde000000000311e9290b46b00148566ea4b4abb680726c0001a1c3624f1d467c03c96c276",
        "d54c414d45342e30555555555555fffb10c4e980c2a41d73c62d82204783acf866181c55555555555555555555555555",
        "5555555555555555555555555555555555fc08fbe000000000321e530d302c0064450588dd53f92217160000c8bb823e",
        "83f86de03090da448a4c414d45342e30aaaaaaaaaaaafffb10c4ea00c2941d73c62d22604a03ad3896241caaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaafb07fbe0000000000a82c946ad0bc1180171fdc687b36c",
        "832ac0001e40562c70dd28f01b25a421c34c414d45342e30555555555555fffb10c4e980c2a01d73c62d82204703ad78",
        "66181c555555555555555555555555555555555555555555555555555555555555fc08ede00000000022054a85b02a02",
        "d08f0788cd517ec9064d8000322ee1f60b22878182436528154c414d45342e30555555555555fffb10c4e980c2b81d71",
        "c4b1802043836d7866304c555555555555555555555555555555555555555555555555555555555555fd08fde0000000",
        "0061452e4aa91582b00765b446c8fb6882e6c000110ebb4a6ca50ee01646a07d354c414d45342e30555555555555fffb",
        "10c4e980c2bc1d73c63d246044036d7896304c5555555555555555555555555555555555555555555555555555555555",
        "5555fd08ebd0000000006244ae8b381502ca80848f71edd920b9b0000251e70bb0a41cd0208170f24a4c414d45342e30",
        "aaaaaafa06aefffb10c4ea00c2b81d73c62d842046036d7896304ce0000000000f222b897a34925f2db60dc7e4740300",
        "30880790790590a00000000000004700d9d321cec1744f92bc00989fcc480e1fc09dcff1fd11de6b17f9fa0f24fff46b",
        "554c414d45342e30555555555555fffb10c4ea00c2ac1d73c62d826048036cf897b00c55555555555555555555555555",
        "555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555",
        "5555555555555555554c414d45342e30555555555555fffb10c4ea00c2b81d71c4b120e048836d78c6b0445555555555",
        "555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555",
        "555555555555555555555555555555555555555555555555555555555555fffb10c4ea00c2b41d73c4ad806046836d78",
        "96b044555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555",
        "5555555555555555555555555555555555555555555555555555555555555555555555555555fffb10c4ea00c2b81d73",
        "c7ad822047036d7897a40c55555555555555555555555555555555555555555555555555555555555555555555555555",
        "55555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555fffb",
        "10c4e980c2a01d73c7ad226045836d7896a4445555555555555555555555555555555555555555555555555555555555",
        "555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555",
        "555555555555fffb10c4fa8002c01d73d4c00020c888ed3f22b201555555555555555555555555555555555555555555",
        "555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555",
        "5555555555555555555555555555fffb10c4d603c00001a41c0000200000348000000455555555555555555555555555",
        "555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555",
        "55555555555555555555555555555555555555555555",
    );

    #[test]
    fn test_decode_source_symphonia_mp3() {
        let path = temp_path("tone.mp3");
        std::fs::write(&path, unhex(TONE_MP3_HEX)).unwrap();

        let (samples, channels, rate) = decode_source(&path).unwrap();
        assert_eq!(rate, 44_100);
        assert_eq!(channels, 1);
        // ~0.5s of audio (plus codec framing/delay).
        assert!(
            samples.len() > 21_000 && samples.len() < 25_000,
            "unexpected decoded length {}",
            samples.len()
        );
        assert!(samples.iter().all(|s| s.is_finite()));
        // The tone survives: ~440 Hz over ~0.5s => ~220 upward crossings.
        let crossings = samples
            .windows(2)
            .filter(|w| w[0] <= 0.0 && w[1] > 0.0)
            .count();
        assert!(
            (180..=260).contains(&crossings),
            "expected ~220 zero crossings, got {}",
            crossings
        );

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_decode_source_routes_flac_to_symphonia() {
        // A FLAC file must not be routed to the hound WAV path; the Symphonia
        // probe rejects it as a WAV and reports an error for this fake data.
        let path = temp_path("fake.flac");
        std::fs::write(&path, b"fLaC-not-really-a-flac").unwrap();
        assert!(decode_source(&path).is_err());
        let _ = std::fs::remove_file(&path);
    }
}
