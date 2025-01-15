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
  id: string
  name: string
  voiceId: string
  settings: {
    stability: number
    similarity: number
    speed: number
    pitch: number
  }
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);

  // Dialog states
  const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  // Audio controls state
  const [volume, setVolume] = useState([50]);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(volume);
  const [stability, setStability] = useState([0.5]);
  const [similarity, setSimilarity] = useState([0.75]);
  const [speed, setSpeed] = useState([1]);
  const [pitch, setPitch] = useState([0]);

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
        speed: speed[0],
        pitch: pitch[0],
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
      setSpeed([preset.settings.speed]);
      setPitch([preset.settings.pitch]);
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
          similarity: similarity[0],
          speed: speed[0],
          pitch: pitch[0],
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
      const selectedVoiceData = voices.find(
        (v) => v.voice_id === selectedVoice
      );
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

  // Handle voice cloning
  const handleVoiceCloning = async (file: File, name: string) => {
    const progressInterval: NodeJS.Timeout | null = null;
  try {
    setIsCloning(true);
    setUploadProgress(0);

    // Validate file
    if (!file.type.includes("audio/") && !file.type.includes("video/mp4")) {
      throw new Error("Please upload a valid audio or MP4 file");
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      throw new Error("File size exceeds 10MB limit");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name);

    // Start upload progress simulation
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 500);

    try {
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

      // Validate the response data
      if (!data.voice_id) {
        throw new Error("Invalid response from voice cloning service");
      }

      // Generate a unique ID if none is provided
      const voiceId = data.voice_id || `custom-${Date.now()}`;

      // Update voices list with new voice
      const newVoice = {
        voice_id: voiceId,
        name: name,
        category: "custom",
      };

      setVoices((prev) => [...prev, newVoice]);

      // Select the new voice
      setSelectedVoice(voiceId);

      // Log success details for debugging
      console.log("Voice cloning successful:", {
        voiceId,
        name,
        response: data,
      });

      toast({
        title: "Success",
        description:
          "Voice cloned successfully! The new voice is now available in the voice selection dropdown.",
      });

      setIsVoiceDialogOpen(false);
    } catch (error) {
      throw error; // Re-throw to be caught by outer try-catch
    }
  } catch (error: any) {
    console.error("Voice cloning error:", error);

    // Clear the progress interval if it exists
  if (progressInterval) {
    clearInterval(progressInterval);
  }
  setUploadProgress(0);

    toast({
      title: "Error",
      description: error.message || "Failed to clone voice. Please try again.",
      variant: "destructive",
    });
  } finally {
    setIsCloning(false);
    setSelectedFile(null);
    setVoiceName("");
    setUploadProgress(0);
  }
};

  const handleVoiceChange = (voiceId: string) => {
    console.log("Selected Voice ID:", voiceId);
    console.log("Is Valid Voice ID?", Boolean(voiceId));
    setSelectedVoice(voiceId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white py-8 ">
      <div className="container mx-auto px-4 mt-20">
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">
                          Voice
                        </label>
                        <Select
                          value={selectedVoice}
                          onValueChange={handleVoiceChange}
                          disabled={isLoadingVoices || isLoading || isPlaying}
                        >
                          <SelectTrigger className="bg-gray-950/50 border-gray-800/50 text-gray-400 [&>span]:text-gray-400 placeholder:text-gray-500">
                            <SelectValue placeholder="Select a voice" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-800">
                            {voices.map((voice) => (
                              <SelectItem
                                key={voice.voice_id}
                                value={voice.voice_id}
                                className="text-gray-100 hover:bg-indigo-500/20"
                              >
                                {voice.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          <label className="text-sm font-medium text-gray-300">
                            Stability
                          </label>
                          <Slider
                            value={stability}
                            onValueChange={setStability}
                            max={1}
                            step={0.01}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-300">
                            Similarity
                          </label>
                          <Slider
                            value={similarity}
                            onValueChange={setSimilarity}
                            max={1}
                            step={0.01}
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-300">
                            Speed
                          </label>
                          <Slider
                            value={speed}
                            onValueChange={setSpeed}
                            min={0.5}
                            max={2}
                            step={0.1}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-300">
                            Pitch
                          </label>
                          <Slider
                            value={pitch}
                            onValueChange={setPitch}
                            min={-20}
                            max={20}
                            step={1}
                            className="w-full"
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
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-300">
                        Recent Generations
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAudioHistory([])}
                        className="border-gray-700 hover:bg-white/80"
                      >
                        Clear History
                      </Button>
                    </div>

                    {audioHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No generation history yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {audioHistory.map((item) => (
                          <div
                            key={item.id}
                            className="bg-gray-900/50 p-4 rounded-lg border border-gray-700"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <p className="text-sm text-gray-300 line-clamp-2">
                                  {item.text}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {item.voiceName} • {item.duration}s
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-400 hover:border"
                                onClick={() => {
                                  setText(item.text);
                                  setSelectedVoice(item.voiceId);
                                }}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(item.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                                <p>Speed: {preset.settings.speed}x</p>
                                <p>Pitch: {preset.settings.pitch}</p>
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
                                  if (selectedFile && voiceName) {
                                    handleVoiceCloning(selectedFile, voiceName);
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
                                      className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md text-white"
                                      value={voiceName}
                                      onChange={(e) =>
                                        setVoiceName(e.target.value)
                                      }
                                      required
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">
                                      Voice Sample (MP4/Audio)
                                    </label>
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="audio/*,video/mp4"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            setSelectedFile(file);
                                          }
                                        }}
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                          fileInputRef.current?.click()
                                        }
                                        className="border-gray-700"
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

                                  {uploadProgress > 0 && (
                                    <div className="space-y-2">
                                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-blue-500 transition-all duration-300"
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
                                      isCloning || !selectedFile || !voiceName
                                    }
                                    className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
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

