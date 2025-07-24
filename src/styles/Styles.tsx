import React, { useState } from 'react';

// Tooltip Component with cyberpunk styling
export const WalletTooltip: React.FC<{ 
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}> = ({ 
  children, 
  content,
  position = 'top'
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div className={`absolute z-50 ${positionClasses[position]}`}>
          <div className="bg-app-quaternary cyberpunk-border color-primary text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
            {content}
          </div>
        </div>
      )}
    </div>
  );
};

// Define the application styles that will be injected
export const initStyles = () => {
  return `
  /* Background grid animation */
  @keyframes grid-pulse {
    0% { opacity: 0.1; }
    50% { opacity: 0.15; }
    100% { opacity: 0.1; }
  }

  .cyberpunk-bg {
    background-color: var(--color-bg-primary);
    background-image: 
      linear-gradient(var(--color-primary-05) 1px, transparent 1px),
      linear-gradient(90deg, var(--color-primary-05) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: center center;
    position: relative;
    overflow: hidden;
  }

  .cyberpunk-bg::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      linear-gradient(var(--color-primary-05) 1px, transparent 1px),
      linear-gradient(90deg, var(--color-primary-05) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: center center;
    animation: grid-pulse 4s infinite;
    z-index: 0;
  }

  /* Glowing border effect */
  @keyframes border-glow {
    0% { box-shadow: 0 0 5px var(--color-primary-50), inset 0 0 5px var(--color-primary-20); }
    50% { box-shadow: 0 0 10px var(--color-primary-80), inset 0 0 10px var(--color-primary-30); }
    100% { box-shadow: 0 0 5px var(--color-primary-50), inset 0 0 5px var(--color-primary-20); }
  }

  .cyberpunk-border {
    border: 1px solid var(--color-primary-50);
    border-radius: 4px;
    animation: border-glow 4s infinite;
  }

  /* Button hover animations */
  @keyframes btn-glow {
    0% { box-shadow: 0 0 5px var(--color-primary); }
    50% { box-shadow: 0 0 15px var(--color-primary); }
    100% { box-shadow: 0 0 5px var(--color-primary); }
  }

  .cyberpunk-btn {
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .cyberpunk-btn:hover {
    animation: btn-glow 2s infinite;
  }

  .cyberpunk-btn::after {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      to bottom right,
      transparent 0%,
      var(--color-primary-30) 50%,
      transparent 100%
    );
    transform: rotate(45deg);
    transition: all 0.5s ease;
    opacity: 0;
  }

  .cyberpunk-btn:hover::after {
    opacity: 1;
    transform: rotate(45deg) translate(50%, 50%);
  }

  /* Glitch effect for text */
  @keyframes glitch {
    2%, 8% { transform: translate(-2px, 0) skew(0.3deg); }
    4%, 6% { transform: translate(2px, 0) skew(-0.3deg); }
    62%, 68% { transform: translate(0, 0) skew(0.33deg); }
    64%, 66% { transform: translate(0, 0) skew(-0.33deg); }
  }

  .cyberpunk-glitch {
    position: relative;
  }

  .cyberpunk-glitch:hover {
    animation: glitch 2s infinite;
  }

  /* Input focus effect */
  .cyberpunk-input:focus {
    box-shadow: 0 0 0 1px var(--color-primary-70), 0 0 15px var(--color-primary-50);
    transition: all 0.3s ease;
  }

  /* Card hover effect */
  .cyberpunk-card {
    transition: all 0.3s ease;
  }

  .cyberpunk-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 7px 20px rgba(0, 0, 0, 0.3), 0 0 15px var(--color-primary-30);
  }

  /* Scan line effect */
  @keyframes scanline {
    0% { 
      transform: translateY(-100%);
      opacity: 0.7;
    }
    100% { 
      transform: translateY(100%);
      opacity: 0;
    }
  }

  .cyberpunk-scanline {
    position: relative;
    overflow: hidden;
  }

  .cyberpunk-scanline::before {
    content: "";
    position: absolute;
    width: 100%;
    height: 10px;
    background: linear-gradient(to bottom, 
      transparent 0%,
      var(--color-primary-20) 50%,
      transparent 100%);
    z-index: 10;
    animation: scanline 8s linear infinite;
  }

  /* Split gutter styling */
  .split-custom .gutter {
    background-color: transparent;
    position: relative;
    transition: background-color 0.3s ease;
  }

  .split-custom .gutter-horizontal {
    cursor: col-resize;
  }

  .split-custom .gutter-horizontal:hover {
    background-color: var(--color-primary-30);
  }

  .split-custom .gutter-horizontal::before,
  .split-custom .gutter-horizontal::after {
    content: "";
    position: absolute;
    width: 1px;
    height: 15px;
    background-color: var(--color-primary-70);
    left: 50%;
    transform: translateX(-50%);
    transition: all 0.3s ease;
  }

  .split-custom .gutter-horizontal::before {
    top: calc(50% - 10px);
  }

  .split-custom .gutter-horizontal::after {
    top: calc(50% + 10px);
  }

  .split-custom .gutter-horizontal:hover::before,
  .split-custom .gutter-horizontal:hover::after {
    background-color: var(--color-primary);
    box-shadow: 0 0 10px var(--color-primary-70);
  }

  /* Neo-futuristic table styling */
  .cyberpunk-table {
    border-collapse: separate;
    border-spacing: 0;
  }

  .cyberpunk-table thead th {
    background-color: var(--color-primary-10);
    border-bottom: 2px solid var(--color-primary-50);
  }

  .cyberpunk-table tbody tr {
    transition: all 0.2s ease;
  }

  .cyberpunk-table tbody tr:hover {
    background-color: var(--color-primary-05);
  }

  /* Neon text effect */
  .neon-text {
    color: var(--color-primary);
    text-shadow: 0 0 5px var(--color-primary-70);
  }

  /* Notification animation */
  @keyframes notification-slide {
    0% { transform: translateX(50px); opacity: 0; }
    10% { transform: translateX(0); opacity: 1; }
    90% { transform: translateX(0); opacity: 1; }
    100% { transform: translateX(50px); opacity: 0; }
  }

  .notification-anim {
    animation: notification-slide 4s forwards;
  }

  /* Loading animation */
  @keyframes loading-pulse {
    0% { transform: scale(0.85); opacity: 0.7; }
    50% { transform: scale(1); opacity: 1; }
    100% { transform: scale(0.85); opacity: 0.7; }
  }

  .loading-anim {
    animation: loading-pulse 1.5s infinite;
  }

  /* Button click effect */
  .cyberpunk-btn:active {
    transform: scale(0.95);
    box-shadow: 0 0 15px var(--color-primary-70);
  }

  /* Menu active state */
  .menu-item-active {
    border-left: 3px solid var(--color-primary);
    background-color: var(--color-primary-10);
  }

  /* Angle brackets for headings */
  .heading-brackets {
    position: relative;
    display: inline-block;
  }

  .heading-brackets::before,
  .heading-brackets::after {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-primary);
    font-weight: bold;
  }

  .heading-brackets::before {
    content: ">";
    left: -15px;
  }

  .heading-brackets::after {
    content: "<";
    right: -15px;
  }

  /* Fade-in animation */
  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  `;
};