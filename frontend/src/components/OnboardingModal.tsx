import React, { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { api } from "../services/api.js";

const AVAILABLE_TOPICS = [
  "Technology", "Science", "Design", "Business", "Culture",
  "Global Issues", "Health", "Innovation", "Education", "Psychology",
  "Art", "Environment", "Creativity", "Future", "Humanity",
  "AI", "Biology", "Music", "History", "Social Change"
];

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleTopic = (topic: string) => {
    const lower = topic.toLowerCase();
    if (selectedTopics.includes(lower)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== lower));
    } else {
      setSelectedTopics([...selectedTopics, lower]);
    }
  };

  const handleSave = async () => {
    if (selectedTopics.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.updatePreferences({
        preferred_tags: selectedTopics,
        onboarding_completed: true,
      });
      onComplete();
    } catch (err: any) {
      setError(err.message || "Failed to save your selections. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white border border-[#E5E2DC] rounded-xl max-w-lg w-full p-6 sm:p-8 shadow-xl">
        <div className="flex items-center space-x-2 text-[#C8102E] text-xs font-semibold uppercase tracking-wider mb-2">
          <Sparkles className="w-4 h-4" />
          <span>Curate Your Journey</span>
        </div>

        <h2 className="font-serif text-2xl font-bold text-[#1A1A1A] mb-2">
          What ideas spark your curiosity?
        </h2>
        <p className="text-sm text-[#6B6860] mb-6">
          Select at least 3 topics to calibrate your initial personalized recommendations.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Topic Grid */}
        <div className="flex flex-wrap gap-2 mb-8 max-h-60 overflow-y-auto pr-1">
          {AVAILABLE_TOPICS.map((topic) => {
            const isSelected = selectedTopics.includes(topic.toLowerCase());
            return (
              <button
                key={topic}
                onClick={() => toggleTopic(topic)}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isSelected
                    ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                    : "bg-[#FAF8F5] text-[#1A1A1A] border-[#E5E2DC] hover:border-[#1A1A1A]"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-[#C8102E]" />}
                <span>{topic}</span>
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E5E2DC]">
          <span className="text-xs text-[#6B6860]">
            {selectedTopics.length} selected (min 3 recommended)
          </span>
          <button
            onClick={handleSave}
            disabled={selectedTopics.length === 0 || isSaving}
            className="px-5 py-2.5 bg-[#C8102E] hover:bg-[#A00C24] disabled:opacity-50 text-white text-xs font-semibold rounded-md transition-colors shadow-sm"
          >
            {isSaving ? "Calibrating..." : "Start Exploring"}
          </button>
        </div>
      </div>
    </div>
  );
};

