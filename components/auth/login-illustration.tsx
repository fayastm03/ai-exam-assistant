'use client';

import React from 'react';

export function LoginIllustration({ activeSlide = 0 }: { activeSlide?: number }) {
  return (
    <div className="relative w-full aspect-square max-w-[340px] flex items-center justify-center select-none">
      <svg
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-2xl"
      >
        <defs>
          {/* Light cone gradient from the lamp */}
          <radialGradient
            id="lampCone"
            cx="200"
            cy="70"
            r="200"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.40" />
            <stop offset="45%" stopColor="#a5b4fc" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </radialGradient>

          {/* Lamp shade gradient */}
          <linearGradient id="lampShade" x1="160" y1="50" x2="240" y2="85" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="40%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          {/* Beanbag shading */}
          <radialGradient id="beanbagGrad" cx="280" cy="220" r="140" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="55%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#090d16" />
          </radialGradient>

          {/* Exam Screen Gradient */}
          <linearGradient id="examScreenGrad" x1="215" y1="205" x2="250" y2="244" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e0e7ff" />
          </linearGradient>

          {/* Badge Glow */}
          <linearGradient id="badgeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* Floor Shadow */}
          <radialGradient id="floorShadow" cx="260" cy="340" rx="120" ry="25" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Floor Shadow */}
        <ellipse cx="260" cy="340" rx="110" ry="22" fill="url(#floorShadow)" />

        {/* Ambient Room Grid Lines */}
        <g stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5">
          <line x1="40" y1="100" x2="360" y2="100" />
          <line x1="40" y1="150" x2="360" y2="150" />
          <line x1="40" y1="200" x2="360" y2="200" />
          <line x1="100" y1="40" x2="100" y2="280" />
          <line x1="160" y1="40" x2="160" y2="280" />
          <line x1="260" y1="40" x2="260" y2="280" />
          <line x1="320" y1="40" x2="320" y2="280" />
        </g>

        {/* Light Beam Cone from ceiling pendant */}
        <path
          d="M 160 85 L 70 330 L 330 330 L 240 85 Z"
          fill="url(#lampCone)"
        />

        {/* Ceiling Cord & Lamp */}
        <line x1="200" y1="0" x2="200" y2="60" stroke="#cbd5e1" strokeWidth="2" />
        <ellipse cx="200" cy="85" rx="42" ry="12" fill="#1e293b" opacity="0.4" />
        <path
          d="M 158 85 C 158 48, 242 48, 242 85 Z"
          fill="url(#lampShade)"
        />
        <ellipse cx="200" cy="84" rx="40" ry="8" fill="#f8fafc" opacity="0.9" />

        {/* Floating Exam Score Badge (Top Right) */}
        <g className="animate-pulse">
          <rect x="72" y="115" width="85" height="42" rx="10" fill="rgba(15, 23, 42, 0.75)" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" />
          <circle cx="92" cy="136" r="11" fill="url(#badgeGrad)" />
          {/* Checkmark icon */}
          <path d="M88 136 L91 139 L97 132" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <text x="109" y="132" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="sans-serif">SCORE</text>
          <text x="109" y="145" fill="#34d399" fontSize="12" fontWeight="800" fontFamily="sans-serif">96% (A+)</text>
        </g>

        {/* Floating Question Timer Badge (Top Left) */}
        <g>
          <rect x="250" y="95" width="80" height="34" rx="8" fill="rgba(15, 23, 42, 0.65)" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" />
          <circle cx="266" cy="112" r="8" fill="#6366f1" />
          {/* Clock hands */}
          <path d="M266 108 L266 112 L269 114" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          <text x="280" y="116" fill="#e0e7ff" fontSize="10" fontWeight="bold" fontFamily="monospace">14:30</text>
        </g>

        {/* Cozy Beanbag Chair */}
        <path
          d="M 200 240
             C 180 180, 260 140, 310 160
             C 365 185, 385 240, 375 290
             C 365 335, 290 350, 230 340
             C 180 330, 160 290, 175 255
             C 185 235, 195 245, 200 240 Z"
          fill="url(#beanbagGrad)"
        />

        {/* Character Torso */}
        <path
          d="M 285 200
             C 275 190, 265 190, 255 205
             C 245 220, 240 250, 250 270
             C 260 280, 285 280, 305 265
             C 315 245, 310 215, 285 200 Z"
          fill="#334155"
        />

        {/* Left Arm */}
        <path
          d="M 260 215
             C 245 225, 235 240, 245 252
             C 255 255, 265 245, 270 235 Z"
          fill="#475569"
        />

        {/* Right Arm */}
        <path
          d="M 285 215
             C 275 225, 260 235, 250 242
             C 240 246, 235 242, 238 238
             C 245 230, 265 218, 280 210 Z"
          fill="#475569"
        />

        {/* Hand */}
        <circle cx="236" cy="242" r="5" fill="#fbcfe8" />

        {/* Head & Neck */}
        <rect x="272" y="180" width="8" height="12" rx="3" fill="#fbcfe8" />
        <circle cx="276" cy="168" r="14" fill="#fbcfe8" />

        {/* Hair */}
        <path
          d="M 264 165
             C 264 150, 288 145, 292 160
             C 294 168, 290 174, 288 176
             C 285 174, 284 165, 278 165
             C 272 165, 268 170, 266 174
             Z"
          fill="#5c3826"
        />

        {/* Face Profile */}
        <ellipse cx="270" cy="167" rx="1.5" ry="2" fill="#1e293b" />
        <path d="M 266 172 Q 268 174 272 173" stroke="#e11d48" strokeWidth="0.8" fill="none" />

        {/* Laptop Base */}
        <path
          d="M 210 242 L 255 244 L 250 250 L 205 247 Z"
          fill="#94a3b8"
        />

        {/* Laptop Screen with online exam UI */}
        <path
          d="M 215 200 L 254 205 L 254 244 L 215 240 Z"
          fill="url(#examScreenGrad)"
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />

        {/* Exam Test Mock lines on Screen */}
        <rect x="220" y="206" width="22" height="3" rx="1.5" fill="#6366f1" />
        <rect x="220" y="213" width="28" height="2" rx="1" fill="#94a3b8" />
        <rect x="220" y="218" width="24" height="2" rx="1" fill="#94a3b8" />
        {/* Option A checked */}
        <circle cx="222" cy="225" r="2" fill="#10b981" />
        <rect x="226" y="224" width="18" height="2" rx="1" fill="#10b981" />
        {/* Option B */}
        <circle cx="222" cy="231" r="2" fill="#cbd5e1" />
        <rect x="226" y="230" width="16" height="2" rx="1" fill="#94a3b8" />

        {/* Legs & Pants */}
        <path
          d="M 255 270
             C 240 270, 210 280, 195 295
             C 185 305, 195 315, 215 310
             C 240 300, 265 290, 275 280 Z"
          fill="#1e293b"
        />
        <path
          d="M 195 295
             C 180 308, 160 322, 150 330
             C 145 334, 155 338, 165 332
             C 180 322, 205 305, 215 298 Z"
          fill="#0f172a"
        />

        {/* White Sneaker Left */}
        <path
          d="M 135 332
             C 135 325, 148 322, 158 328
             C 162 331, 160 339, 150 342
             C 140 344, 133 338, 135 332 Z"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {/* White Sneaker Right */}
        <path
          d="M 220 338
             C 220 332, 230 330, 240 334
             C 245 336, 242 344, 235 346
             C 225 348, 218 344, 220 338 Z"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
