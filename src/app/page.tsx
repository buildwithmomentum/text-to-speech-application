"use client"

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Volume2, Play, Square, Loader2, RefreshCcw, Wand2, History, 
  Download, Clock, Settings, Save, Mic, RotateCcw, VolumeX, 
  Volume1, Book, Upload, 
  MicVocal
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { exportAudioBlob } from '@/utils/audioUtils'
import { useToast } from '@/hooks/use-toast'
import { Switch } from '@/components/ui/switch'
import HistoryComponent from '@/components/elevenlabs-history'
import VoiceSelector from '@/components/voice-selector-component'
import EnhancedVoiceSelector from '@/components/voice-selector-component'

interface Voice {
  voice_id: string
  name: string
  category: string
}

interface AudioHistory {
  id: string
  text: string
  voiceId: string
  voiceName: string
  timestamp: Date
  duration: number
}

interface VoicePreset {
  id: string;
  name: string;
  voiceId: string;
  settings: {
    stability: number;
    similarity: number;
    style: number;
    use_speaker_boost: boolean;
  };
}

interface SavedAudio {
  blob: Blob
  text: string
  voiceId: string
  timestamp: Date
}

let audioContext: AudioContext | null = null
let gainNode: GainNode | null = null

export default function TTSApp() {
  // Core state
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dialog states
  const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  // Audio controls state
  const [volume, setVolume] = useState([50]);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(volume);
  const [stability, setStability] = useState([0.5]);
  const [similarity, setSimilarity] = useState([0.70]);
  const [speed, setSpeed] = useState([1]);
  const [pitch, setPitch] = useState([0]);
  const [style, setStyle] = useState([0]);
  const [speakerBoost, setSpeakerBoost] = useState(true);

  // History and presets state
  const [audioHistory, setAudioHistory] = useState<AudioHistory[]>([]);
  const [presets, setPresets] = useState<VoicePreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [savedAudio, setSavedAudio] = useState<SavedAudio | null>(null);

  // Voice cloning state
  const [isCloning, setIsCloning] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Text analysis state
  const [characterCount, setCharacterCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);

  // Refs
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Initialize audio context
  const initAudioContext = () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
    }
  };

  // Load history and presets from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem("audioHistory");
    const savedPresets = localStorage.getItem("voicePresets");

    if (savedHistory) {
      try {
        setAudioHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error("Error loading history:", error);
      }
    }
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (error) {
        console.error("Error loading presets:", error);
      }
    }
  }, []);

  // Save history and presets to localStorage
  useEffect(() => {
    localStorage.setItem("audioHistory", JSON.stringify(audioHistory));
  }, [audioHistory]);

  useEffect(() => {
    localStorage.setItem("voicePresets", JSON.stringify(presets));
  }, [presets]);

  // Text analysis effect
  useEffect(() => {
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    setWordCount(words.length);
    setCharacterCount(text.length);
    setEstimatedDuration(Math.ceil((words.length / 150) * 60));
  }, [text]);

  // Fetch available voices
  const fetchVoices = async () => {
    try {
      setIsLoadingVoices(true);
      const response = await fetch("/api/voices");
      if (!response.ok) {
        throw new Error("Failed to fetch voices");
      }
      const voicesData = await response.json();
      setVoices(voicesData);
      if (voicesData.length > 0 && !selectedVoice) {
        setSelectedVoice(voicesData[0].voice_id);
      }
    } catch (error) {
      console.error("Error fetching voices:", error);
      toast({
        title: "Error",
        description: "Failed to fetch voices. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVoices(false);
    }
  };

  // Fetch voices on component mount
  useEffect(() => {
    fetchVoices();
  }, []);

  // Handle volume changes
  const handleVolumeChange = (newVolume: number[]) => {
    setVolume(newVolume);
    if (gainNode) {
      gainNode.gain.value = newVolume[0] / 100;
    }
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    if (isMuted) {
      setVolume(previousVolume);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      setVolume([0]);
      setIsMuted(true);
    }
  };

  // Save preset
  const handleSavePreset = (name: string) => {
    if (!name.trim()) return;

    const newPreset: VoicePreset = {
      id: Date.now().toString(),
      name,
      voiceId: selectedVoice,
      settings: {
        stability: stability[0],
        similarity: similarity[0],
        style: style[0],
        use_speaker_boost: speakerBoost,
      },
    };
    setPresets((prev) => [...prev, newPreset]);
    toast({
      title: "Preset Saved",
      description: `"${name}" has been saved to your presets.`,
    });
    setIsPresetDialogOpen(false);
    setPresetName("");
  };

  // Load preset
  const loadPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      setSelectedVoice(preset.voiceId);
      setStability([preset.settings.stability]);
      setSimilarity([preset.settings.similarity]);
      setStyle([preset.settings.style]);
      setSpeakerBoost(preset.settings.use_speaker_boost);
      setSelectedPreset(presetId);
      toast({
        title: "Preset Loaded",
        description: `"${preset.name}" settings have been applied.`,
      });
    }
  };

  // Reset settings
  const resetSettings = () => {
    setStability([0.5]);
    setSimilarity([0.75]);
    setSpeed([1]);
    setPitch([0]);
    setSelectedPreset(null);
    toast({
      title: "Settings Reset",
      description: "All voice settings have been reset to default values.",
    });
  };

  // Generate random example text
  const generateRandomText = () => {
    const examples = [
      "Welcome to the future of voice technology! This AI-powered text-to-speech system creates remarkably natural voices.",
      "okay stop look how freaking cool this is that I started doing and I'm doing it like way too often okay so you like do okay I'll show you cuz it's freaking cool okay hi oh okay nice did you just delay your words after you mouth them to someone you're coming up to meet them and they go hi like what do you be like who just did that like like that's odd like hey so fun hey so a lot of people are asking about how I did the lagging voice thing and they want a tutorial and all I can say is like find words that don't make your lips touch like hi and hey um like I'm not that good with ventriloquism I can't do crazy like cool songs like that but if you can go hey and I also promise it's not a voiceover look there's no one else in the room this is my voice you can see my throat move I hope hey yeah hey hey hey I don't know how I was to prove it to you guys but uh yeah literally all you have to do is find words that don't make your lips touch and then just hi hey all the time super fun so yeah that's about it",
      "Imagine a world where every story comes to life through the power of artificial intelligence and natural-sounding voices.",
      "Transform your written words into captivating speech with our cutting-edge text-to-speech technology.",
    ];
    setText(examples[Math.floor(Math.random() * examples.length)]);
  };

  // Handle speech synthesis
  const synthesizeSpeech = async () => {
    if (!text.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text to convert to speech",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      setIsPlaying(true);

      initAudioContext();

    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voiceId: selectedVoice,
        stability: stability[0],
        similarity_boost: similarity[0],
        style: style[0],
        use_speaker_boost: speakerBoost,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate speech");
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([arrayBuffer], { type: "audio/mpeg" });

    // Save audio for export
    setSavedAudio({
      blob: audioBlob,
      text,
      voiceId: selectedVoice,
      timestamp: new Date(),
    });

    // Add to history
    const selectedVoiceData = voices.find((v) => v.voice_id === selectedVoice);
    const newHistoryItem: AudioHistory = {
      id: Date.now().toString(),
      text,
      voiceId: selectedVoice,
      voiceName: selectedVoiceData?.name || "Unknown Voice",
      timestamp: new Date(),
      duration: estimatedDuration,
    };

    setAudioHistory((prev) => {
      const newHistory = [newHistoryItem, ...prev].slice(0, 10);
      return newHistory;
    });

    // Play the audio
    if (audioContext && gainNode) {
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      }

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);
      sourceRef.current = source;

      gainNode.gain.value = volume[0] / 100;
      source.start(0);
      source.onended = () => {
        setIsPlaying(false);
        sourceRef.current = null;
      };

      toast({
        title: "Success",
        description: "Audio generated successfully!",
      });
    }
  } catch (error) {
    console.error("Error synthesizing speech:", error);
    toast({
      title: "Error",
      description: "Failed to generate speech. Please try again.",
      variant: "destructive",
    });
    setIsPlaying(false);
  } finally {
    setIsLoading(false);
  }
  };

  // Stop audio playback
  const stopSpeech = () => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    setIsPlaying(false);
  };

  // Handle audio export
  const handleExportAudio = () => {
    if (!savedAudio) {
      toast({
        title: "Error",
        description: "No audio available to export",
        variant: "destructive",
      });
      return;
    }

    const filename = `tts-${new Date().toISOString().slice(0, 10)}.mp3`;
    exportAudioBlob(savedAudio.blob, filename);

    toast({
      title: "Success",
      description: "Audio file downloaded successfully",
    });
  };

  const handleVoicesUpdated = (updatedVoices: Voice[]) => {
    setVoices(updatedVoices);
  };

  // Add these functions to handle recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        setRecordedAudio(blob);
        setAudioURL(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const resetRecording = () => {
    setRecordedAudio(null);
    setAudioURL(null);
    setRecordingDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  // Update the handleVoiceCloning function to handle both uploaded and recorded audio
  // Updated handleVoiceCloning function with proper formData construction
  const handleVoiceCloning = async (fileOrBlob: File | Blob, name: string) => {
    const progressInterval: NodeJS.Timeout | null = null;
    try {
      setIsCloning(true);
      setUploadProgress(0);

      // Create FormData and append required fields for ElevenLabs API
      const formData = new FormData();

      // Add name with proper field name
      formData.append("name", name);

      // Add files array for ElevenLabs API
      if (fileOrBlob instanceof Blob) {
        // For recorded audio
        const audioFile = new File([fileOrBlob], "recorded-audio.wav", {
          type: "audio/wav",
        });
        formData.append("files", audioFile);
      } else {
        // For uploaded file
        formData.append("files", fileOrBlob);
      }

      // Start upload progress simulation
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch("/api/clone-voice", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to clone voice");
      }

      const data = await response.json();
      if (!data.voice_id) {
        throw new Error("Invalid response from voice cloning service");
      }

      // Update voices list with new voice
      const newVoice = {
        voice_id: data.voice_id,
        name: name,
        category: "custom",
      };

      setVoices((prev) => [...prev, newVoice]);
      setSelectedVoice(data.voice_id);

      toast({
        title: "Success",
        description:
          "Voice cloned successfully! The new voice is now available.",
      });

      setIsVoiceDialogOpen(false);
    } catch (error: any) {
      console.error("Voice cloning error:", error);
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setUploadProgress(0);
      toast({
        title: "Error",
        description:
          error.message || "Failed to clone voice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
      setSelectedFile(null);
      setVoiceName("");
      setUploadProgress(0);
      resetRecording();
    }
  };

  const handleDeleteVoice = async (voiceId: string) => {
    try {
      const response = await fetch(`/api/clone-voice/${voiceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete voice");
      }

      // Update voices list
      setVoices(voices.filter((voice) => voice.voice_id !== voiceId));

      // If the deleted voice was selected, reset selection
      if (selectedVoice === voiceId) {
        setSelectedVoice("");
      }

      toast({
        title: "Success",
        description: "Voice deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting voice:", error);
      toast({
        title: "Error",
        description: "Failed to delete voice. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleVoiceChange = (voiceId: string) => {
    console.log("Selected Voice ID:", voiceId);
    console.log("Is Valid Voice ID?", Boolean(voiceId));
    setSelectedVoice(voiceId);
  };

  // Update the Dialog content to include recording functionality
  const recordingUI = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">
          Record Voice Sample
        </h3>
        {recordedAudio && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetRecording}
            className="text-red-400 hover:text-red-300"
          >
            Reset
          </Button>
        )}
      </div>

      <div className="flex flex-col items-center space-y-4 p-4 border border-gray-800/50 rounded-lg bg-gray-950/30">
        {!recordedAudio ? (
          <>
            <Button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-16 h-16 rounded-full ${
                isRecording
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"
              }`}
            >
              <Mic
                className={`h-6 w-6 ${isRecording ? "animate-pulse" : ""}`}
              />
            </Button>
            <span className="text-sm text-gray-400">
              {isRecording
                ? `Recording: ${recordingDuration}s`
                : "Click to start recording"}
            </span>
          </>
        ) : (
          <div className="w-full space-y-3">
            <audio
              ref={audioRef}
              src={audioURL || ""}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            <div className="flex items-center justify-center space-x-4">
              <Button
                type="button"
                onClick={handlePlayPause}
                className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300"
              >
                {isPlaying ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <span className="text-sm text-gray-400">
                {recordingDuration}s recorded
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              {audioRef.current && (
                <div
                  className="h-full bg-indigo-500/50"
                  style={{
                    width: `${
                      (audioRef.current.currentTime / recordingDuration) * 100
                    }%`,
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white py-8 ">
      <div className="container mx-auto px-4 ">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-500 to-indigo-500">
            AI Voice Generator
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Transform your text into natural-sounding speech using advanced AI
            technology
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="editor" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 bg-gray-900/40 border border-gray-800/50">
              <TabsTrigger
                value="editor"
                className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300"
              >
                <Book className="h-4 w-4 mr-2" />
                Editor
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300"
              >
                <History className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
              <TabsTrigger
                value="clone"
                className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300"
              >
                <MicVocal className="h-4 w-4 mr-2" />
                Cloning Voice
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor">
              <Card className="bg-gray-900/40 backdrop-blur-lg border-gray-800/50 shadow-lg shadow-black/20">
                <CardContent className="p-6">
                  {/* Text Input Section */}
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center space-x-4">
                        <label className="text-sm font-medium text-gray-300">
                          Your Text
                        </label>
                        <span className="text-xs text-gray-500">
                          {wordCount} words | {characterCount} characters | ~
                          {estimatedDuration}s
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                          onClick={() => setText("")}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Clear
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                          onClick={generateRandomText}
                        >
                          <Wand2 className="h-4 w-4" />
                          Example
                        </Button>
                      </div>
                    </div>
                    <div className="relative group">
                      <Textarea
                        placeholder="Enter your text here..."
                        className="min-h-32 resize-none bg-gray-950/50 border-gray-800/50 focus:border-indigo-500/50 transition-colors text-gray-100 placeholder:text-gray-600"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        disabled={isLoading || isPlaying}
                      />
                    </div>
                  </div>

                  {/* Voice Controls */}
                  <div className="space-y-6">
                    {/* Voice Selection and Presets */}
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2 ">
                        {/* <label className="text-sm font-medium text-gray-300">
                          Voice
                        </label> */}
                        <EnhancedVoiceSelector
                          voices={voices}
                          selectedVoice={selectedVoice}
                          onVoiceChange={handleVoiceChange}
                          onDeleteVoice={handleDeleteVoice}
                          isLoading={isLoadingVoices}
                          isDisabled={isLoading || isPlaying}
                          onVoicesUpdated={handleVoicesUpdated}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">
                          Preset
                        </label>
                        <Select
                          value={selectedPreset || ""}
                          onValueChange={loadPreset}
                        >
                          <SelectTrigger className="bg-gray-950/50 border-gray-800/50 text-gray-400 [&>span]:text-gray-400 placeholder:text-gray-500">
                            <SelectValue placeholder="Load preset" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-800">
                            {presets.map((preset) => (
                              <SelectItem
                                key={preset.id}
                                value={preset.id}
                                className="text-gray-100 hover:bg-indigo-500/20"
                              >
                                {preset.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Advanced Controls */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-gray-300">
                              Stability
                            </label>
                            <span className="text-xs text-gray-500">
                              {stability[0].toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={stability}
                            onValueChange={setStability}
                            min={0}
                            max={1}
                            step={0.01}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500">
                            Higher values make voice more consistent but can
                            reduce expressiveness
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-gray-300">
                              Similarity Boost
                            </label>
                            <span className="text-xs text-gray-500">
                              {similarity[0].toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={similarity}
                            onValueChange={setSimilarity}
                            min={0}
                            max={1}
                            step={0.01}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500">
                            Higher values make voice more similar to original
                            but can reduce quality
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-gray-300">
                              Style
                            </label>
                            <span className="text-xs text-gray-500">
                              {style[0].toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={style}
                            onValueChange={setStyle}
                            min={0}
                            max={1}
                            step={0.01}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500">
                            Control speaking style intensity
                          </p>
                        </div>

                        <div className="flex items-center justify-between space-x-4 mt-4">
                          <div>
                            <label className="text-sm font-medium text-gray-300">
                              Speaker Boost
                            </label>
                            <p className="text-xs text-gray-500">
                              Enhance voice clarity and reduce distortion
                            </p>
                          </div>
                          <Switch
                            checked={speakerBoost}
                            onCheckedChange={setSpeakerBoost}
                            className="data-[state=checked]:bg-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Volume Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">
                          Volume
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleMuteToggle}
                          className="text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                        >
                          {isMuted ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume1 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center space-x-4">
                        <Volume2 className="h-5 w-5 text-gray-400" />
                        <Slider
                          value={volume}
                          onValueChange={handleVolumeChange}
                          max={100}
                          step={1}
                          className="w-full"
                          disabled={isLoading}
                        />
                        <span className="w-12 text-sm text-gray-400">
                          {volume}%
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between pt-4">
                      <div className="flex space-x-2">
                        <Dialog
                          open={isPresetDialogOpen}
                          onOpenChange={setIsPresetDialogOpen}
                        >
                          <DialogTrigger asChild>
                            <Button className="text-gray-400 border hover:text-indigo-300 hover:bg-indigo-500/10">
                              <Save className="h-4 w-4 " />
                              Save Preset
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-gray-800 border-gray-700 text-gray-300">
                            <DialogHeader>
                              <DialogTitle>Save Preset</DialogTitle>
                              <DialogDescription>
                                Save current voice settings as a preset for
                                future use.
                              </DialogDescription>
                            </DialogHeader>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleSavePreset(presetName);
                              }}
                            >
                              <div className="py-4">
                                <input
                                  type="text"
                                  placeholder="Enter preset name"
                                  className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md text-white"
                                  value={presetName}
                                  onChange={(e) =>
                                    setPresetName(e.target.value)
                                  }
                                  required
                                />
                              </div>
                              <DialogFooter>
                                <Button
                                  type="submit"
                                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
                                  disabled={!presetName.trim()}
                                >
                                  Save Preset
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>

                        <Button
                          className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
                          onClick={resetSettings}
                        >
                          <RotateCcw className="h-4 w-4 " />
                          Reset
                        </Button>
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          className="text-gray-400 border hover:text-indigo-300 hover:bg-indigo-500/10"
                          onClick={handleExportAudio}
                          disabled={!savedAudio}
                        >
                          <Download className="h-4 w-4" />
                          Export
                        </Button>

                        {isPlaying ? (
                          <Button
                            variant="destructive"
                            onClick={stopSpeech}
                            disabled={isLoading}
                            className="w-32 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300"
                          >
                            <Square className="h-4 w-4 mr-2" />
                            Stop
                          </Button>
                        ) : (
                          <Button
                            onClick={synthesizeSpeech}
                            disabled={
                              isLoading || !text.trim() || !selectedVoice
                            }
                            className="w-32 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300"
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4  animate-spin" />
                            ) : (
                              <Play className="h-4 w-4 " />
                            )}
                            {isLoading ? "Loading" : "Generate"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card className="bg-gray-800/50 backdrop-blur-lg border-gray-700">
                <CardContent className="p-6">
                  <HistoryComponent
                    onSelectText={(text, voiceId) => {
                      setText(text);
                      setSelectedVoice(voiceId);
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="clone">
              <Card className="bg-gray-800/50 backdrop-blur-lg border-gray-700">
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4 text-gray-300">
                        Voice Presets
                      </h3>
                      {presets.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <Save className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No saved presets</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 grid-cols-2">
                          {presets.map((preset) => (
                            <div
                              key={preset.id}
                              className="bg-gray-900/50 p-4 rounded-lg border border-gray-700"
                            >
                              <div className="flex justify-between items-center mb-2 text-gray-300">
                                <h4 className="font-medium">{preset.name}</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300"
                                  onClick={() => {
                                    setPresets(
                                      presets.filter((p) => p.id !== preset.id)
                                    );
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                              <div className="space-y-1 text-sm text-gray-400">
                                <p>Stability: {preset.settings.stability}</p>
                                <p>Similarity: {preset.settings.similarity}</p>
                                <p>Style: {preset.settings.style}</p>
                                <p>
                                  User Boost:{" "}
                                  {preset.settings.use_speaker_boost}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-300">
                        Voice Recording
                      </h3>
                      <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium mb-1 text-gray-500">
                              Custom Voice Cloning
                            </h4>
                            <p className="text-sm text-gray-400">
                              Upload your voice sample to create a custom voice
                              clone
                            </p>
                          </div>

                          <Dialog
                            open={isVoiceDialogOpen}
                            onOpenChange={setIsVoiceDialogOpen}
                          >
                            <DialogTrigger asChild>
                              <Button className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400">
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Sample
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-gray-800 border-gray-700">
                              <DialogHeader>
                                <DialogTitle className="text-gray-300">
                                  Clone Your Voice
                                </DialogTitle>
                                <DialogDescription>
                                  Upload a clear voice sample to create your
                                  custom voice clone.
                                </DialogDescription>
                              </DialogHeader>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (
                                    voiceName &&
                                    (selectedFile || recordedAudio)
                                  ) {
                                    handleVoiceCloning(
                                      selectedFile || recordedAudio!,
                                      voiceName
                                    );
                                  }
                                }}
                              >
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">
                                      Voice Name
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Enter a name for your voice"
                                      className="w-full p-2 bg-gray-950/50 border border-gray-800/50 rounded-md text-gray-100 focus:border-indigo-500/50"
                                      value={voiceName}
                                      onChange={(e) =>
                                        setVoiceName(e.target.value)
                                      }
                                      required
                                    />
                                  </div>

                                  <Tabs
                                    defaultValue="record"
                                    className="w-full"
                                  >
                                    <TabsList className="grid w-full grid-cols-2 bg-gray-900/40">
                                      <TabsTrigger
                                        value="record"
                                        className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-gray-300 "
                                      >
                                        Record Voice
                                      </TabsTrigger>
                                      <TabsTrigger
                                        value="upload"
                                        className="data-[state=active]:bg-indigo-500/20  data-[state=active]:text-gray-300"
                                      >
                                        Upload File
                                      </TabsTrigger>
                                    </TabsList>

                                    <TabsContent
                                      value="record"
                                      className="mt-4"
                                    >
                                      {recordingUI}
                                    </TabsContent>

                                    <TabsContent
                                      value="upload"
                                      className="mt-4"
                                    >
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-300">
                                          Voice Sample (MP4/Audio)
                                        </label>
                                        <div className="flex items-center space-x-2">
                                          <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept="audio/*,video/mp4"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => {
                                              const files = Array.from(
                                                e.target.files || []
                                              );
                                              if (files) {
                                                setSelectedFile(files[0]);
                                                resetRecording(); // Reset any recorded audio
                                              }
                                            }}
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                              fileInputRef.current?.click()
                                            }
                                            className="border-gray-800/50 hover:bg-indigo-500/10 hover:text-indigo-300"
                                          >
                                            Choose File
                                          </Button>
                                          <span className="text-sm text-gray-400">
                                            {selectedFile?.name ||
                                              "No file selected"}
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                          Supported formats: MP4, MP3, WAV, etc.
                                          Maximum size: 10MB
                                        </p>
                                      </div>
                                    </TabsContent>
                                  </Tabs>

                                  {uploadProgress > 0 && (
                                    <div className="space-y-2">
                                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-indigo-500 transition-all duration-300"
                                          style={{
                                            width: `${uploadProgress}%`,
                                          }}
                                        />
                                      </div>
                                      <p className="text-sm text-gray-400 text-center">
                                        {uploadProgress}% uploaded
                                      </p>
                                    </div>
                                  )}
                                </div>

                                <DialogFooter>
                                  <Button
                                    type="submit"
                                    disabled={
                                      isCloning ||
                                      !voiceName ||
                                      (!selectedFile && !recordedAudio)
                                    }
                                    className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300"
                                  >
                                    {isCloning ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Cloning...
                                      </>
                                    ) : (
                                      "Clone Voice"
                                    )}
                                  </Button>
                                </DialogFooter>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

