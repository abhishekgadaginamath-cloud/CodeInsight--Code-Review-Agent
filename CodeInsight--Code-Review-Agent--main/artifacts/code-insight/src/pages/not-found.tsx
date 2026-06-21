import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Code2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <Code2 size={48} className="text-purple-400/40 mx-auto mb-6" />
        <h1 className="text-6xl font-bold text-gradient-purple mb-4">404</h1>
        <p className="text-muted-foreground mb-8">This page doesn't exist.</p>
        <Button
          onClick={() => setLocation("/")}
          className="bg-purple-600 hover:bg-purple-500 text-white"
        >
          <ArrowLeft size={16} className="mr-2" /> Go Home
        </Button>
      </motion.div>
    </div>
  );
}
