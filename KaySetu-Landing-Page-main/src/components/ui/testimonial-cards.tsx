"use client";

import * as React from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Quote } from 'lucide-react';

interface TestimonialCardProps {
  handleShuffle: () => void;
  testimonial: string;
  position: string;
  id: number;
  author: string;
  image: string;
}

export function TestimonialCard ({ handleShuffle, testimonial, position, id, author, image }: TestimonialCardProps) {
  const dragRef = React.useRef(0);
  const isFront = position === "front";

  return (
    <motion.div
      style={{
        zIndex: position === "front" ? "2" : position === "middle" ? "1" : "0"
      }}
      animate={{
        rotate: position === "front" ? "-6deg" : position === "middle" ? "0deg" : "6deg",
        x: position === "front" ? "0%" : position === "middle" ? "33%" : "66%"
      }}
      drag={true}
      dragElastic={0.35}
      dragListener={isFront}
      dragConstraints={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
      onDragStart={(e, info: PanInfo) => {
        dragRef.current = info.point.x;
      }}
      onDragEnd={(e, info: PanInfo) => {
        if (dragRef.current - info.point.x > 150 || info.point.x - dragRef.current > 150) {
          handleShuffle();
        }
        dragRef.current = 0;
      }}
      transition={{ duration: 0.35 }}
      className={`absolute left-0 top-0 grid h-[450px] w-[350px] select-none place-content-center space-y-6 rounded-2xl border-2 border-slate-700 bg-slate-800 p-8 shadow-xl ${
        isFront ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <div className="relative mx-auto">
        <img
          src={image}
          alt={`Avatar of ${author}`}
          className="pointer-events-none h-24 w-24 rounded-full border-2 border-slate-700 bg-slate-200 object-cover"
        />
        <div className="absolute -bottom-2 -right-2 bg-indigo-500 rounded-full p-2">
          <Quote className="w-4 h-4 text-white" />
        </div>
      </div>
      <span className="text-center text-[15px] leading-relaxed text-slate-300">&quot;{testimonial}&quot;</span>
      <span className="text-center text-sm font-semibold text-indigo-400">{author}</span>
    </motion.div>
  );
}
