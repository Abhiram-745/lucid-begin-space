import { useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function NotificationBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-primary text-primary-foreground py-2 px-4 flex justify-between items-center text-xs uppercase tracking-wider overflow-hidden"
      >
        <span className="flex-1 text-center truncate">
          We've updated our Privacy Policy and Terms of Service. Please review them.
        </span>
        <button
          onClick={() => setIsVisible(false)}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
