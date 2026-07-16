"use client";
import React from "react";
import KineticDotsLoader from "@/components/kinetic-dots-loader";

export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100%',
      backgroundColor: '#0f172a',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999
    }}>
      <KineticDotsLoader />
    </div>
  );
}
