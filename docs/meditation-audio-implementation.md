# Meditation Audio Generator - Implementation Guide

## Overview

This document outlines the technical implementation for converting meditation text (with markup for pauses, silence, and sound effects) into a complete audio file with optional background music.

---

## Architecture

```
User Input → LLM (Meditation Text with Markup) → Parser → Audio Processor → Final MP3
```

### Flow:

1. **Parse** meditation text into segments (speech, pauses, silence, sound effects)
2. **Generate** audio for each segment using TTS API
3. **Mix** background music (optional)
4. **Concatenate** all segments into final audio file

---

## Text Markup Format

The LLM should output meditation text with the following markup:

```
Regular meditation text goes here...

*[PAUSE: 5 seconds]*

More meditation text...

*[SILENCE: 10 minutes]*

*[SOUND: gong.mp3]*
```

### Supported Markers:

- `*[PAUSE: X seconds]*` - Short pause (typically 3-15 seconds)
- `*[SILENCE: X minutes]*` - Extended silence (typically 1-30 minutes)
- `*[SOUND: filename.mp3]*` - Sound effect (bell, gong, singing bowl, etc.)

---

## Tech Stack

### Required Dependencies

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "fluent-ffmpeg": "^2.1.2",
    "@google-cloud/text-to-speech": "^5.0.0"
  }
}
```

### System Requirements

- **Node.js** 16+
- **FFmpeg** (for audio processing)
  - macOS: `brew install ffmpeg`
  - Ubuntu: `sudo apt-get install ffmpeg`
  - Windows: Download from ffmpeg.org

---

## Text Parsing

### Parser Function

```javascript
parseMeditationText(text) {
  const segments = [];
  const lines = text.split('\n');
  let currentSpeech = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Match pause: *[PAUSE: 5 seconds]*
    const pauseMatch = trimmedLine.match(/^\*\[PAUSE:\s*(\d+)\s*seconds?\]\*$/i);
    if (pauseMatch) {
      if (currentSpeech.length > 0) {
        segments.push({ type: 'speech', content: currentSpeech.join(' ').trim() });
        currentSpeech = [];
      }
      segments.push({ type: 'pause', duration: parseInt(pauseMatch[1]) });
      continue;
    }

    // Match silence: *[SILENCE: 10 minutes]*
    const silenceMatch = trimmedLine.match(/^\*\[SILENCE:\s*(\d+)\s*minutes?\]\*$/i);
    if (silenceMatch) {
      if (currentSpeech.length > 0) {
        segments.push({ type: 'speech', content: currentSpeech.join(' ').trim() });
        currentSpeech = [];
      }
      segments.push({ type: 'silence', duration: parseInt(silenceMatch[1]) * 60 });
      continue;
    }

    // Match sound: *[SOUND: gong.mp3]*
    const soundMatch = trimmedLine.match(/^\*\[SOUND:\s*(.+?)\]\*$/i);
    if (soundMatch) {
      if (currentSpeech.length > 0) {
        segments.push({ type: 'speech', content: currentSpeech.join(' ').trim() });
        currentSpeech = [];
      }
      segments.push({ type: 'sound', file: soundMatch[1] });
      continue;
    }

    // Regular speech text
    if (trimmedLine && !trimmedLine.startsWith('*[')) {
      currentSpeech.push(trimmedLine);
    }
  }

  // Add remaining speech
  if (currentSpeech.length > 0) {
    segments.push({ type: 'speech', content: currentSpeech.join(' ').trim() });
  }

  return segments;
}
```

### Output Format

```javascript
[
  { type: "speech", content: "Welcome to this meditation..." },
  { type: "pause", duration: 5 },
  { type: "speech", content: "Take a deep breath..." },
  { type: "silence", duration: 600 },
  { type: "sound", file: "gong.mp3" },
];
```

---

## Text-to-Speech Integration

### Option 1: ElevenLabs (Best Quality)

**Pros:**

- Most natural, expressive voices
- Emotion control
- Voice cloning available

**Cons:**

- More expensive (~$0.30 per 1K characters)

```javascript
async generateSpeech(text, outputPath) {
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
    {
      text: text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,        // 0-1, higher = more consistent
        similarity_boost: 0.75, // 0-1, higher = closer to original voice
        style: 0.0,            // 0-1, expressiveness
        use_speaker_boost: true
      }
    },
    {
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': this.elevenLabsApiKey,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer'
    }
  );

  await fs.writeFile(outputPath, response.data);
  return outputPath;
}
```

**Recommended Voices for Meditation:**

- `EXAVITQu4vr4xnSDxMaL` - Sarah (calm, soothing)
- `TX3LPaxmHKxFdv7VOQHJ` - Elli (gentle, meditative)

### Option 2: Google Cloud TTS (Cost-Effective)

**Pros:**

- Very affordable (~$4 per 1M characters)
- SSML support for fine-grained control
- High quality neural voices

**Cons:**

- Slightly less natural than ElevenLabs

```javascript
const textToSpeech = require('@google-cloud/text-to-speech');

async generateSpeech(text, outputPath) {
  const client = new textToSpeech.TextToSpeechClient({
    keyFilename: './google-credentials.json'
  });

  const ssml = `
    <speak>
      <prosody rate="slow" pitch="-2st">
        ${text}
      </prosody>
    </speak>
  `;

  const request = {
    input: { ssml },
    voice: {
      languageCode: 'en-US',
      name: 'en-US-Journey-F', // Calm female voice
      ssmlGender: 'FEMALE'
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 0.85,  // Slower for meditation
      pitch: -2.0,         // Lower pitch
    }
  };

  const [response] = await client.synthesizeSpeech(request);
  await fs.writeFile(outputPath, response.audioContent, 'binary');
  return outputPath;
}
```

**Recommended Voices:**

- `en-US-Journey-F` - Calm, soothing female
- `en-US-Journey-D` - Deep, grounding male
- `en-GB-Neural2-A` - British female (elegant)

### Option 3: Azure Speech Services

**Pros:**

- Custom neural voices
- Excellent multilingual support
- Good pricing

```javascript
const sdk = require('microsoft-cognitiveservices-speech-sdk');

async generateSpeech(text, outputPath) {
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY,
    process.env.AZURE_REGION
  );

  speechConfig.speechSynthesisVoiceName = 'en-US-AvaNeural'; // Calm voice

  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputPath);
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

  return new Promise((resolve, reject) => {
    synthesizer.speakTextAsync(
      text,
      result => {
        synthesizer.close();
        resolve(outputPath);
      },
      error => {
        synthesizer.close();
        reject(error);
      }
    );
  });
}
```

---

## Silence Generation

Generate silent audio segments using FFmpeg:

```javascript
async generateSilence(durationSeconds, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input('anullsrc=r=44100:cl=stereo')  // Generate silent audio
      .inputFormat('lavfi')                  // Use FFmpeg's lavfi
      .duration(durationSeconds)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}
```

---

## Audio Concatenation

Combine all segments into a single file:

```javascript
async concatenateAudio(audioFiles, outputPath) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    // Add all input files
    audioFiles.forEach(file => command.input(file));

    // Create filter for concatenation
    const filterComplex = audioFiles
      .map((_, i) => `[${i}:a]`)
      .join('') + `concat=n=${audioFiles.length}:v=0:a=1[out]`;

    command
      .complexFilter(filterComplex)
      .outputOptions('-map', '[out]')
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}
```

---

## Background Music Mixing

### Approach 1: Simple Background Music (Continuous Loop)

Mix background ambient music underneath the entire meditation:

```javascript
async mixBackgroundMusic(voiceAudioPath, musicPath, outputPath, musicVolume = 0.15) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(voiceAudioPath)
      .input(musicPath)
      .complexFilter([
        // Loop the music if it's shorter than voice
        '[1:a]aloop=loop=-1:size=2e+09[music]',

        // Reduce music volume (default 15% of original)
        `[music]volume=${musicVolume}[musicvol]`,

        // Mix voice and music
        '[0:a][musicvol]amix=inputs=2:duration=first:dropout_transition=2[out]'
      ])
      .outputOptions('-map', '[out]')
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}
```

**Usage:**

```javascript
// After concatenating all segments
await this.mixBackgroundMusic(
  "./temp/meditation-voice-only.mp3",
  "./music/ambient-peaceful.mp3",
  "./output/meditation-final.mp3",
  0.15, // Music at 15% volume
);
```

### Approach 2: Dynamic Volume Ducking

Automatically lower music volume when voice is speaking:

```javascript
async mixWithDucking(voiceAudioPath, musicPath, outputPath, options = {}) {
  const {
    musicVolume = 0.2,      // Normal music volume (20%)
    duckVolume = 0.05,      // Music volume during speech (5%)
    threshold = -35,        // Audio threshold to trigger ducking (dB)
    attack = 0.5,           // How quickly to duck (seconds)
    release = 1.0           // How quickly to restore volume (seconds)
  } = options;

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(voiceAudioPath)
      .input(musicPath)
      .complexFilter([
        // Loop music
        '[1:a]aloop=loop=-1:size=2e+09[music]',

        // Set base music volume
        `[music]volume=${musicVolume}[musicvol]`,

        // Create sidechain compression (ducking)
        // When voice audio exceeds threshold, reduce music volume
        `[musicvol][0:a]sidechaincompress=threshold=${threshold}dB:ratio=4:attack=${attack * 1000}:release=${release * 1000}[ducked]`,

        // Mix voice and ducked music
        '[0:a][ducked]amix=inputs=2:duration=first[out]'
      ])
      .outputOptions('-map', '[out]')
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}
```

**Usage:**

```javascript
await this.mixWithDucking(
  "./temp/meditation-voice-only.mp3",
  "./music/ambient.mp3",
  "./output/meditation-final.mp3",
  {
    musicVolume: 0.2, // Music at 20% during silence
    duckVolume: 0.05, // Music at 5% during speech
    threshold: -30, // Trigger ducking at -30dB
    attack: 0.5, // Duck over 0.5 seconds
    release: 1.5, // Restore over 1.5 seconds
  },
);
```

### Approach 3: Segmented Music Control

Different music for different parts of the meditation:

```javascript
async mixSegmentedMusic(segments, outputPath) {
  /*
  segments = [
    { audioPath: './speech1.mp3', musicPath: './intro-music.mp3', musicVolume: 0.3 },
    { audioPath: './silence.mp3', musicPath: './deep-ambient.mp3', musicVolume: 0.15 },
    { audioPath: './speech2.mp3', musicPath: './outro-music.mp3', musicVolume: 0.2 }
  ]
  */

  const mixedSegments = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const tempOutput = `./temp/mixed_segment_${i}.mp3`;

    if (segment.musicPath) {
      await this.mixBackgroundMusic(
        segment.audioPath,
        segment.musicPath,
        tempOutput,
        segment.musicVolume || 0.15
      );
      mixedSegments.push(tempOutput);
    } else {
      // No music for this segment
      mixedSegments.push(segment.audioPath);
    }
  }

  // Concatenate all mixed segments
  await this.concatenateAudio(mixedSegments, outputPath);
  return outputPath;
}
```

### Approach 4: Fade In/Out Effects

Add smooth transitions for music:

```javascript
async mixWithFades(voiceAudioPath, musicPath, outputPath, options = {}) {
  const {
    musicVolume = 0.15,
    fadeInDuration = 5,      // Fade in over 5 seconds
    fadeOutDuration = 5       // Fade out over last 5 seconds
  } = options;

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(voiceAudioPath)
      .input(musicPath)
      .complexFilter([
        // Get duration of voice audio
        '[1:a]aloop=loop=-1:size=2e+09[music]',

        // Apply volume and fades
        `[music]volume=${musicVolume},afade=t=in:st=0:d=${fadeInDuration},afade=t=out:st=duration-${fadeOutDuration}:d=${fadeOutDuration}[musicfaded]`,

        // Mix
        '[0:a][musicfaded]amix=inputs=2:duration=first[out]'
      ])
      .outputOptions('-map', '[out]')
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}
```

### Approach 5: Binaural Beats/Brainwave Entrainment

Generate or mix binaural beats for specific states:

```javascript
async generateBinauralBeat(frequency, duration, outputPath) {
  // Binaural beat frequencies:
  // Delta (0.5-4 Hz): Deep sleep
  // Theta (4-8 Hz): Meditation, creativity
  // Alpha (8-14 Hz): Relaxation, light meditation
  // Beta (14-30 Hz): Focus, alertness

  const baseFreq = 200; // Base carrier frequency in Hz
  const leftFreq = baseFreq;
  const rightFreq = baseFreq + frequency; // Creates the binaural beat

  return new Promise((resolve, reject) => {
    ffmpeg()
      // Generate left channel sine wave
      .input(`sine=frequency=${leftFreq}:duration=${duration}`)
      .inputFormat('lavfi')

      // Generate right channel sine wave
      .input(`sine=frequency=${rightFreq}:duration=${duration}`)
      .inputFormat('lavfi')

      // Merge into stereo and reduce volume
      .complexFilter([
        '[0:a][1:a]amerge=inputs=2,volume=0.1[out]'
      ])
      .outputOptions('-map', '[out]')
      .audioCodec('libmp3lame')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

// Then mix with meditation
async mixBinauralBeat(voiceAudioPath, beatFrequency, outputPath) {
  const beatPath = './temp/binaural-beat.mp3';

  // Get duration of voice audio first
  const duration = await this.getAudioDuration(voiceAudioPath);

  // Generate binaural beat
  await this.generateBinauralBeat(beatFrequency, duration, beatPath);

  // Mix them together
  await this.mixBackgroundMusic(voiceAudioPath, beatPath, outputPath, 0.1);
}
```

---

## Complete Workflow with Background Music

```javascript
class MeditationAudioGenerator {
  async generate(meditationText, outputPath, options = {}) {
    const {
      backgroundMusic = null,
      musicVolume = 0.15,
      useDucking = true,
      fadeIn = 5,
      fadeOut = 5,
      binauralFrequency = null, // e.g., 7.83 (Schumann resonance, Theta)
    } = options;

    try {
      // 1. Parse text
      const segments = this.parseMeditationText(meditationText);

      // 2. Generate audio for each segment
      const audioFiles = await this.processSegments(segments);

      // 3. Concatenate voice segments
      const voiceOnlyPath = "./temp/voice-only.mp3";
      await this.concatenateAudio(audioFiles, voiceOnlyPath);

      // 4. Mix with background music if provided
      if (backgroundMusic || binauralFrequency) {
        if (binauralFrequency) {
          // Generate and mix binaural beat
          await this.mixBinauralBeat(
            voiceOnlyPath,
            binauralFrequency,
            outputPath,
          );
        } else if (useDucking) {
          // Use dynamic ducking
          await this.mixWithDucking(
            voiceOnlyPath,
            backgroundMusic,
            outputPath,
            {
              musicVolume,
              threshold: -30,
              attack: 0.5,
              release: 1.5,
            },
          );
        } else {
          // Simple mix with fades
          await this.mixWithFades(voiceOnlyPath, backgroundMusic, outputPath, {
            musicVolume,
            fadeInDuration: fadeIn,
            fadeOutDuration: fadeOut,
          });
        }
      } else {
        // No music, just copy voice-only
        await fs.copyFile(voiceOnlyPath, outputPath);
      }

      // 5. Cleanup
      await this.cleanup();

      return outputPath;
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }
}
```

**Usage Example:**

```javascript
const generator = new MeditationAudioGenerator({
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  voiceId: "EXAVITQu4vr4xnSDxMaL",
});

await generator.generate(meditationText, "./output/abundance-meditation.mp3", {
  backgroundMusic: "./music/ambient-ocean.mp3",
  musicVolume: 0.15,
  useDucking: true,
  fadeIn: 5,
  fadeOut: 10,
  binauralFrequency: 7.83, // Optional: Theta waves for deep meditation
});
```

---

## Recommended Background Music Sources

### Free/Royalty-Free:

- **Incompetech** (incompetech.com) - Attribution required
- **FreePD** (freepd.com) - Public domain
- **YouTube Audio Library** - Free with attribution
- **ccMixter** (ccmixter.org) - Creative Commons

### Paid/Professional:

- **Epidemic Sound** - Subscription ($15-50/mo)
- **AudioJungle** - Per-track ($5-50)
- **Artlist** - Subscription ($9.99-30/mo)

### Meditation-Specific:

- Look for: "528 Hz", "Solfeggio frequencies", "Tibetan bowls", "Ambient meditation"
- Genres: Ambient, drone, nature sounds, singing bowls, binaural beats

---

## Sound Effects Library

Recommended sound effects for meditation endings:

```
sound-effects/
├── gong-gentle.mp3          # Soft gong
├── gong-deep.mp3            # Deep resonant gong
├── bell-tibetan.mp3         # Tingsha bells
├── bell-crystal.mp3         # Crystal singing bowl
├── chime-soft.mp3           # Wind chimes
├── bowls-singing.mp3        # Singing bowls
└── nature-birdsong.mp3      # Natural sounds
```

**Free Sources:**

- Freesound.org
- Zapsplat.com
- BBC Sound Effects

---

## Performance Optimization

### Caching Strategy

```javascript
// Cache common meditation components
const cache = new Map();

async getCachedAudio(key, generator) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  const result = await generator();
  cache.set(key, result);
  return result;
}

// Example: Cache common phrases
const intro = await getCachedAudio(
  'intro-welcome',
  () => this.generateSpeech('Welcome to this meditation...')
);
```

### Parallel Processing

```javascript
async processSegments(segments) {
  const audioFiles = [];

  // Process speech segments in parallel
  const promises = segments.map(async (segment, i) => {
    const tempFile = `./temp/segment_${i}.mp3`;

    switch (segment.type) {
      case 'speech':
        await this.generateSpeech(segment.content, tempFile);
        break;
      case 'pause':
      case 'silence':
        await this.generateSilence(segment.duration, tempFile);
        break;
      case 'sound':
        await fs.copyFile(
          `./sound-effects/${segment.file}`,
          tempFile
        );
        break;
    }

    return { index: i, path: tempFile };
  });

  const results = await Promise.all(promises);

  // Sort by index to maintain order
  return results.sort((a, b) => a.index - b.index).map(r => r.path);
}
```

---

## Cost Estimation

### Per 10-Minute Meditation

**ElevenLabs:**

- ~1,500 characters speech
- Cost: ~$0.45 per meditation

**Google Cloud TTS:**

- ~1,500 characters speech
- Cost: ~$0.006 per meditation

**Azure:**

- ~1,500 characters speech
- Cost: ~$0.024 per meditation

**Processing:**

- FFmpeg: Free
- Compute: ~0.1-0.5 seconds per minute of audio

---

## Error Handling

```javascript
async generate(meditationText, outputPath, options) {
  try {
    // Validate input
    if (!meditationText || meditationText.trim().length === 0) {
      throw new Error('Meditation text cannot be empty');
    }

    // Ensure temp directory exists
    await fs.mkdir(this.tempDir, { recursive: true });

    // Process meditation
    const segments = this.parseMeditationText(meditationText);

    if (segments.length === 0) {
      throw new Error('No valid segments found in meditation text');
    }

    // ... rest of generation

  } catch (error) {
    console.error('Generation failed:', error.message);

    // Cleanup on error
    await this.cleanup();

    // Re-throw with context
    throw new Error(`Meditation generation failed: ${error.message}`);
  }
}
```

---

## Testing

```javascript
// test-meditation-generator.js
const MeditationAudioGenerator = require("./meditation-audio-generator");

async function runTests() {
  const generator = new MeditationAudioGenerator({
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: "EXAVITQu4vr4xnSDxMaL",
  });

  // Test 1: Basic meditation
  const basicMeditation = `
    Welcome to this test meditation.
    *[PAUSE: 2 seconds]*
    Take a deep breath.
    *[SOUND: bell.mp3]*
  `;

  await generator.generate(basicMeditation, "./test/basic.mp3");
  console.log("✅ Basic meditation generated");

  // Test 2: With background music
  await generator.generate(basicMeditation, "./test/with-music.mp3", {
    backgroundMusic: "./music/ambient.mp3",
    musicVolume: 0.15,
    useDucking: true,
  });
  console.log("✅ Meditation with music generated");

  // Test 3: Long silence
  const longSilence = `
    Begin your practice.
    *[SILENCE: 1 minutes]*
    Return to awareness.
    *[SOUND: gong.mp3]*
  `;

  await generator.generate(longSilence, "./test/long-silence.mp3");
  console.log("✅ Long silence meditation generated");
}

runTests().catch(console.error);
```

---

## Production Considerations

### 1. Queue System

For high-volume applications, use a job queue:

- **Bull** (Redis-based) - For Node.js
- **AWS SQS** - Managed queue service
- **RabbitMQ** - Self-hosted option

### 2. Storage

- Store generated audio in S3/GCS/Azure Blob
- Use CDN for delivery (CloudFront, CloudFlare)
- Implement cache headers for static audio

### 3. Monitoring

- Track TTS API usage and costs
- Monitor generation time
- Alert on failures

### 4. Rate Limiting

```javascript
const rateLimit = require("express-rate-limit");

const meditationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 meditations per 15 min
  message: "Too many meditation requests, please try again later.",
});

app.post("/api/generate-meditation", meditationLimiter, async (req, res) => {
  // Handle request
});
```

---

## Example API Endpoint

```javascript
const express = require("express");
const app = express();
const MeditationAudioGenerator = require("./meditation-audio-generator");

app.post("/api/generate-meditation", async (req, res) => {
  try {
    const { meditationText, options } = req.body;

    const generator = new MeditationAudioGenerator({
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: req.body.voiceId || "default-voice",
    });

    const outputPath = `./output/${Date.now()}-meditation.mp3`;

    await generator.generate(meditationText, outputPath, options);

    // Upload to S3 or return file
    res.download(outputPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
```

---

## Future Enhancements

1. **Voice Customization**: Allow users to select from different meditation guide voices
2. **Multi-language Support**: Generate meditations in different languages
3. **Preset Templates**: Pre-defined meditation structures (body scan, breath work, loving-kindness)
4. **Real-time Preview**: Stream audio as it's being generated
5. **Advanced Music Sync**: Beat-match music to meditation pacing
6. **Emotional Analysis**: Adjust voice tone based on meditation content sentiment
7. **3D Audio/Spatial Audio**: Binaural recording for immersive experience

---

## Resources

### Documentation

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [ElevenLabs API Docs](https://elevenlabs.io/docs)
- [Google Cloud TTS Docs](https://cloud.google.com/text-to-speech/docs)
- [Azure Speech Docs](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/)

### Libraries

- [fluent-ffmpeg GitHub](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)
- [node-ffmpeg-stream](https://github.com/phaux/node-ffmpeg-stream)

### Inspiration

- Calm app
- Headspace
- Insight Timer
- Balance meditation app
