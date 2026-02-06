import React from 'react';

const HeroSection = () => {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-[#404EED] pt-[80px] lg:pt-[120px]">
      {/* Background Stars/Patterns (Aesthetic representation) */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <div 
          className="absolute h-full w-full"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.15) 1px, transparent 1px), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 1px, transparent 1px), radial-gradient(circle at 40% 70%, rgba(255,255,255,0.12) 1px, transparent 1px), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: '100px 100px'
          }}
        />
      </div>

      <div className="container relative z-10 px-6 lg:px-10 max-w-[1180px] mx-auto">
        <div className="flex flex-col lg:flex-row items-center lg:items-start lg:justify-between lg:pt-20">
          
          {/* Text Content */}
          <div className="w-full lg:w-[45%] text-center lg:text-left z-20">
            <h1 className="font-display text-[40px] md:text-[56px] lg:text-[72px] font-black text-white leading-[0.95] tracking-[-0.02em] uppercase mb-6 lg:mb-8 max-w-[600px] mx-auto lg:mx-0">
              Group chat that’s all fun & games
            </h1>
            <p className="font-body text-[16px] md:text-[20px] text-white leading-[1.6] max-w-[500px] mx-auto lg:mx-0 opacity-90 mb-8 lg:mb-10">
              Discord is great for playing games and chilling with friends, or even building a worldwide community. Customize your own space to talk, play, and hang out.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a 
                href="/download" 
                className="inline-flex items-center justify-center px-8 h-[56px] text-[20px] font-medium text-[#23272A] bg-white rounded-[28px] hover:text-[#5865F2] transition-colors duration-200 shadow-lg"
              >
                <svg className="mr-2 w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 16L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 13L12 16L15 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 20H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download for Linux
              </a>
              <a 
                href="https://discord.com/login" 
                className="inline-flex items-center justify-center px-8 h-[56px] text-[20px] font-medium text-white bg-[#23272A] rounded-[28px] hover:bg-[#36393F] transition-colors duration-200 shadow-lg"
              >
                Open Discord in your browser
              </a>
            </div>
          </div>

          {/* Hero Composition Image */}
          <div className="relative mt-12 lg:mt-0 w-full lg:w-[65%] lg:-mr-[15%] pointer-events-none select-none">
            <div className="relative aspect-[12/9] w-full transform scale-110 lg:scale-125 origin-center lg:origin-top-left">
              {/* Main Desktop + Scene composition */}
              {/* Using provided assets from the list */}
              <div className="absolute inset-0">
                <img 
                  src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/31642d45-2dd0-494b-8925-fa25f0f82134-discord-com/assets/images/683dd52d4c9254eada79dd11_Discord_20Boy-8.webp" 
                  alt="Discord Characters and Scene"
                  style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                  className="z-10"
                />
              </div>
              
              {/* Leaning Girl character overlay */}
              <div className="absolute bottom-[10%] -left-[10%] w-[40%] aspect-square z-20">
                <img 
                  src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/31642d45-2dd0-494b-8925-fa25f0f82134-discord-com/assets/images/683e0f99bf66ed8e1d55ff2c_Leaning_20Girl_2003-6.webp" 
                  alt="Character leaning"
                  style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                  className="animate-float"
                />
              </div>

              {/* Glowing Gradients behind assets */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-radial-gradient from-[#5865F2]/40 to-transparent blur-[80px] -z-10" />
            </div>
          </div>

        </div>
      </div>

      {/* Cloud-like styling for transition at the bottom (optional visual flourish common in Discord hero) */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0] pointer-events-none">
          <svg className="relative block w-full h-[60px]" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <path d="M0,0 C150,110 350,110 500,110 C650,110 850,110 1200,0 L1200,120 L0,120 Z" fill="#23272A"></path>
          </svg>
      </div>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .bg-radial-gradient {
          background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 70%);
        }
      `}</style>
    </section>
  );
};

export default HeroSection;