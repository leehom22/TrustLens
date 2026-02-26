import React from 'react';

/**
 * ScrollingBanner Component
 * 
 * Clones the horizontal scrolling marquee section that repeats the words 
 * 'PLAY', 'CHAT', and 'HANG OUT' separated by the Discord logo icon in white.
 * 
 * Constraints:
 * - Theme: Dark
 * - Component: Pixel-perfect ticker based on design instructions and screenshots.
 * - Animation: infinite linear scroll.
 */

const ScrollingBanner = () => {
  // The phrasing repeated in the ticker
  const items = [
    { text: 'PLAY' },
    { text: 'CHAT' },
    { text: 'HANG OUT' },
  ];

  // Asset for the white Discord icon used as separator
  // Source: <assets> tag provided in instructions
  const discordIcon = "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/31642d45-2dd0-494b-8925-fa25f0f82134-discord-com/assets/svgs/66e278299a53f5bf88615e90_Symbol-5.svg";

  // Replicate the sequence multiple times to ensure seamless looping
  const tickerContent = Array(12).fill(items).flat();

  return (
    <section 
      className="relative w-full overflow-hidden bg-[#23272A] py-[24px] border-t border-b border-white/10"
      aria-label="Scrolling Banner"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker-scroll 25s linear infinite;
        }
      `}} />
      
      <div className="flex whitespace-nowrap">
        <div className="flex items-center gap-x-[48px] animate-ticker px-[24px]">
          {tickerContent.map((item, idx) => (
            <React.Fragment key={idx}>
              <div className="flex items-center gap-x-[48px]">
                {/* Separator Icon */}
                <div className="relative w-[44px] h-[34px] flex-shrink-0">
                  <img 
                    src={discordIcon} 
                    alt="Discord Icon" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    className="object-contain"
                  />
                </div>
                {/* Text Content */}
                <span className="text-white font-black text-[clamp(32px,4vw,64px)] leading-none select-none tracking-[-0.02em] font-display">
                  {item.text}
                </span>
              </div>
            </React.Fragment>
          ))}
          
          {/* Duplicate for seamless loop */}
          {tickerContent.map((item, idx) => (
            <React.Fragment key={`second-${idx}`}>
              <div className="flex items-center gap-x-[48px]">
                <div className="relative w-[44px] h-[34px] flex-shrink-0">
                  <img 
                    src={discordIcon} 
                    alt="Discord Icon" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    className="object-contain"
                  />
                </div>
                <span className="text-white font-black text-[clamp(32px,4vw,64px)] leading-none select-none tracking-[-0.02em] font-display">
                  {item.text}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ScrollingBanner;