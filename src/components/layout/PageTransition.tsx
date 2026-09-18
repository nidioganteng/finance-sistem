"use client";
import { motion } from "framer-motion";
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="flex flex-col gap-5 flex-1"
    >
      {children}
    </motion.div>
  );
}
