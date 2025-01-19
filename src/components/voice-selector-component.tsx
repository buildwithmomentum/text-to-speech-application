import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Eye, Loader2, LayoutGrid, List } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels?: {
    accent?: string;
    description?: string;
    age?: string;
    gender?: string;
    use_case?: string;
  };
  preview_url?: string;
}

interface VoiceSelectorProps {
  voices: Voice[];
  selectedVoice: string;
  onVoiceChange: (voiceId: string) => void;
  onDeleteVoice: (voiceId: string) => Promise<void>;
  onVoicesUpdated?: (updatedVoices: Voice[]) => void;
  isLoading?: boolean;
  isDisabled?: boolean;
}

interface DialogState {
  type: "details" | "rename";
  voiceId: string | null;
}

export default function EnhancedVoiceSelector({
  voices,
  selectedVoice,
  onVoiceChange,
  onDeleteVoice,
  onVoicesUpdated,
  isLoading = false,
  isDisabled = false,
}: VoiceSelectorProps) {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [deleteVoiceId, setDeleteVoiceId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({
    type: "details",
    voiceId: null,
  });
  const [newVoiceName, setNewVoiceName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "selector">("selector");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const clonedVoices = voices.filter((voice) => voice.category === "cloned");

  const handlePlayPreview = async (previewUrl: string, voiceId: string) => {
    if (isDisabled) return;

    if (isPlaying === voiceId) {
      audioRef.current?.pause();
      setIsPlaying(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(previewUrl);
      audio.onended = () => setIsPlaying(null);
      try {
        await audio.play();
        audioRef.current = audio;
        setIsPlaying(voiceId);
      } catch (error) {
        console.error("Error playing audio:", error);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteVoiceId) return;

    setIsDeleting(true);
    try {
      await onDeleteVoice(deleteVoiceId);
    } finally {
      setIsDeleting(false);
      setDeleteVoiceId(null);
    }
  };

  const handleRename = async () => {
    if (!dialog.voiceId || !newVoiceName.trim()) return;

    try {
      const response = await fetch(`/api/clone-voice/${dialog.voiceId}/name`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newVoiceName }),
      });

      if (!response.ok) {
        throw new Error("Failed to rename voice");
      }

      // Update voices with the new name
      const updatedVoices = voices.map((voice) =>
        voice.voice_id === dialog.voiceId
          ? { ...voice, name: newVoiceName }
          : voice
      );

      // Notify parent component about the update
      onVoicesUpdated?.(updatedVoices);

      toast({
        title: "Success",
        description: "Voice renamed successfully",
      });

      // Close dialog and reset state
      setDialog({ type: "details", voiceId: null });
      setNewVoiceName("");
    } catch (error) {
      console.error("Error renaming voice:", error);
      toast({
        title: "Error",
        description: "Failed to rename voice. Please try again.",
        variant: "destructive",
      });
    }
	};
	
	const renderVoiceCard = (voice: Voice) => (
    <div
      key={voice.voice_id}
      className={`flex flex-col h-24 rounded-lg border transition-all duration-200 
       ${isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
       ${
         selectedVoice === voice.voice_id
           ? "border-indigo-500/50 bg-indigo-500/10"
           : "border-gray-800/50 bg-gray-900/50 hover:border-gray-700"
       }`}
       onClick={() => !isDisabled && onVoiceChange(voice.voice_id)}
    >
      <div className="flex flex-col justify-between h-full p-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-200">{voice.name}</span>
            {voice.preview_url && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-gray-300 hover:bg-indigo-500/20 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPreview(voice.preview_url!, voice.voice_id);
                }}
                disabled={isDisabled}
              >
                {isPlaying === voice.voice_id ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:bg-indigo-500/20 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              setDialog({ type: "details", voiceId: voice.voice_id });
            }}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:bg-indigo-500/20 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onVoiceChange(voice.voice_id);
            }}
          >
            Use
          </Button>
        </div>
      </div>
    </div>
  );

  const renderSelector = () => (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        {isLoading ? (
          <div className="w-full">
            <Skeleton className="h-10 w-full bg-gray-800" />
          </div>
        ) : (
          <Select
            value={selectedVoice}
            onValueChange={onVoiceChange}
            disabled={isDisabled}
          >
            <SelectTrigger className="w-full bg-gray-950/50 border-gray-800/50 text-gray-400 focus:ring-gray-700">
              <SelectValue
                placeholder="Select a voice"
                className="text-gray-400"
              />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
              {clonedVoices.map((voice) => (
                <SelectItem
                  key={voice.voice_id}
                  value={voice.voice_id}
                  className="text-gray-100 hover:bg-indigo-500/20 focus:bg-indigo-500/20"
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{voice.name}</span>
                    {voice.preview_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-300 hover:bg-indigo-500/20 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayPreview(voice.preview_url!, voice.voice_id);
                        }}
                        disabled={isDisabled}
                      >
                        {isPlaying === voice.voice_id ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:bg-indigo-500/20 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            if (selectedVoice) {
              setDialog({ type: "details", voiceId: selectedVoice });
            }
          }}
          disabled={!selectedVoice || isDisabled}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return renderSelector();
  }

return (
  <div className="space-y-6">
    {clonedVoices.length > 0 && (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-gray-300">
            Your Cloned Voices
          </Label>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className={`p-1 hover:bg-indigo-500/20 ${
                viewMode === "grid" ? "text-indigo-400" : "text-gray-400"
              }`}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`p-1 hover:bg-indigo-500/20 ${
                viewMode === "selector" ? "text-indigo-400" : "text-gray-400"
              }`}
              onClick={() => setViewMode("selector")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {viewMode === "selector" ? (
          renderSelector()
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {clonedVoices.map(renderVoiceCard)}
          </div>
        )}
      </div>
    )}
    {/* Details/Rename Dialog */}
    <Dialog
      open={dialog.voiceId !== null}
      onOpenChange={(open) =>
        !open && setDialog({ type: "details", voiceId: null })
      }
    >
      <DialogContent className="bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-gray-200">
            {dialog.type === "rename"
              ? "Rename Voice"
              : voices.find((v) => v.voice_id === dialog.voiceId)?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {dialog.type === "details" ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300">
                  Voice Name
                </label>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">
                    {voices.find((v) => v.voice_id === dialog.voiceId)?.name}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewVoiceName(
                        voices.find((v) => v.voice_id === dialog.voiceId)
                          ?.name || ""
                      );
                      setDialog({ type: "rename", voiceId: dialog.voiceId });
                    }}
                    className="text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                  >
                    Rename
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">
                  Voice ID
                </label>
                <p className="text-sm text-gray-400">{dialog.voiceId}</p>
              </div>
              {voices.find((v) => v.voice_id === dialog.voiceId)
                ?.preview_url && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const voice = voices.find(
                        (v) => v.voice_id === dialog.voiceId
                      );
                      if (voice?.preview_url) {
                        handlePlayPreview(voice.preview_url, voice.voice_id);
                      }
                    }}
                  >
                    {isPlaying === dialog.voiceId ? (
                      <Pause className="h-4 w-4 mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Preview
                  </Button>
                </div>
              )}
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  setDialog({ type: "details", voiceId: null });
                  setDeleteVoiceId(dialog.voiceId);
                }}
              >
                Delete Voice
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  New Name
                </label>
                <Input
                  value={newVoiceName}
                  onChange={(e) => setNewVoiceName(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-gray-100"
                  placeholder="Enter new name"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setDialog({ type: "details", voiceId: dialog.voiceId })
                  }
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRename}
                  disabled={!newVoiceName.trim()}
                  className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300"
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <AlertDialog
      open={deleteVoiceId !== null}
      onOpenChange={() => setDeleteVoiceId(null)}
    >
      <AlertDialogContent className="bg-gray-900 border-gray-800">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Voice</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;
            {voices.find((v) => v.voice_id === deleteVoiceId)?.name}&quot;? This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            disabled={isDeleting}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400"
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);
}
