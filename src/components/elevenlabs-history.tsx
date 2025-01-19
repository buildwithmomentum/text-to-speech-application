import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  History,
  Clock,
  Download,
  RefreshCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

interface HistoryItem {
  history_item_id: string;
  text: string;
  voice_id: string;
  voice_name: string;
  date_unix: number;
  character_count_change_from: number;
  character_count_change_to: number;
  content_type: string;
  state: string;
  settings: {
    similarity_boost: number;
    stability: number;
    style: number;
    use_speaker_boost: boolean;
  };
}

interface HistoryComponentProps {
  onSelectText?: (text: string, voiceId: string) => void;
}

export default function HistoryComponent({
  onSelectText,
}: HistoryComponentProps) {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/history");
      if (!response.ok) {
        throw new Error("Failed to fetch history");
      }
      const data = await response.json();
      setHistoryItems(data.history || []);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast({
        title: "Error",
        description: "Failed to fetch history items",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDeleteHistoryItem = async (historyItemId: string) => {
    try {
      const response = await fetch(`/api/history/${historyItemId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete history item");
      }

      setHistoryItems((prevItems) =>
        prevItems.filter((item) => item.history_item_id !== historyItemId)
      );

      toast({
        title: "Success",
        description: "History item deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting history item:", error);
      toast({
        title: "Error",
        description: "Failed to delete history item",
        variant: "destructive",
      });
    }
  };

  const downloadAudio = async (historyItemId: string) => {
    try {
      const response = await fetch(`/api/history/${historyItemId}/audio`);
      if (!response.ok) {
        throw new Error("Failed to download audio");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tts-${historyItemId}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Audio downloaded successfully",
      });
    } catch (error) {
      console.error("Error downloading audio:", error);
      toast({
        title: "Error",
        description: "Failed to download audio",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <History className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-medium text-gray-300">
            Generation History
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchHistory}
          className="border-gray-800 hover:bg-gray-800"
          disabled={isLoading}
        >
          <RefreshCcw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Content Section */}
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : historyItems.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No generation history available</p>
        </div>
      ) : (
        <ScrollArea className="h-[600px] rounded-md border border-gray-800">
          <div className="p-4 space-y-4">
            {historyItems.map((item) => (
              <Card
                key={item.history_item_id}
                className="bg-gray-900/50 border-gray-800"
              >
                <CardContent className="p-4">
                  <Collapsible>
                    <div className="flex items-start justify-between w-full">
                      <div className="flex-1 min-w-0">
                        <CollapsibleTrigger
                          onClick={() => toggleExpand(item.history_item_id)}
                          className="flex items-start space-x-2 hover:text-gray-200 transition-colors w-full text-left group"
                        >
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm text-gray-300 ${
                                !expandedItems.has(item.history_item_id)
                                  ? "line-clamp-2"
                                  : ""
                              } group-hover:text-gray-200`}
                            >
                              {item.text}
                            </p>
                          </div>
                          <div className="pt-1 flex-shrink-0">
                            {expandedItems.has(item.history_item_id) ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <div className="flex items-center space-x-2 mt-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <p className="text-xs text-gray-500">
                            {format(new Date(item.date_unix * 1000), "PPp")}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadAudio(item.history_item_id);
                          }}
                          className="text-gray-400 hover:text-blue-400 hover:bg-blue-500/10"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectText?.(item.text, item.voice_id);
                          }}
                          className="text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10"
                        >
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHistoryItem(item.history_item_id);
                          }}
                          className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="text-xs text-gray-500">
                        Voice: {item.voice_name}
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        Characters: {item.character_count_change_to}
                      </div>
                    </div>
                  </Collapsible>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
