"use client";

import { TestimonialCard } from "@/components/ui/testimonial-cards";
import { useState } from "react";

const testimonials = [
  {
    id: 1,
    testimonial: "I feel like I've learned as much from X as I did completing my masters. It's the first thing I read every morning.",
    author: "Jenn F. - Marketing Director @ Square",
    image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=128&h=128&fit=crop&q=80"
  },
  {
    id: 2,
    testimonial: "My boss thinks I know what I'm doing. Honestly, I just read this newsletter.", 
    author: "Adrian Y. - Product Marketing @ Meta",
    image: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=128&h=128&fit=crop&q=80"
  },
  {
    id: 3,
    testimonial: "Can not believe this is free. If X was $5,000 a month, it would be worth every penny. I plan to name my next child after X.",
    author: "Devin R. - Growth Marketing Lead @ OpenAI",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop&q=80"
  }
];

export function ShuffleCards() {
  const [positions, setPositions] = useState(["front", "middle", "back"]);

  const handleShuffle = () => {
    const newPositions = [...positions];
    const last = newPositions.pop();
    if (last) newPositions.unshift(last);
    setPositions(newPositions);
  };

  return (
    <div className="grid place-content-center overflow-hidden px-8 py-24 w-full">
      <div className="relative -ml-[100px] h-[450px] w-[350px] md:-ml-[175px]">
        {testimonials.map((testimonial, index) => (
          <TestimonialCard
            key={testimonial.id}
            {...testimonial}
            handleShuffle={handleShuffle}
            position={positions[index]}
          />
        ))}
      </div>
    </div>
  );
}
