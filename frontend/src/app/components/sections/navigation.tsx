import React, { useState, useEffect } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Download", href: "/download" },
    { name: "Nitro", href: "/nitro" },
    { name: "Discover", href: "/servers" },
    {
      name: "Safety",
      href: "/safety",
      dropdown: [
        { label: "Resources", items: ["Family Center", "Safety Library", "Safety News", "Teen Charter"] },
        { label: "Hubs", items: ["Parent Hub", "Policy Hub", "Privacy Hub", "Transparency Hub", "Wellbeing Hub"] },
      ],
      asset: "https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/678a4dee303240abdd278abf_Egg-1.webp"
    },
    {
      name: "Quests",
      href: "/ads/quests",
      dropdown: [
        { label: "Resources", items: ["Advertising", "Success Stories", "Quests FAQ"] }
      ],
      asset: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/31642d45-2dd0-494b-8925-fa25f0f82134-discord-com/assets/images/678a4e92695af76b1f7487a3_Set_201_2015-2.webp"
    },
    {
      name: "Support",
      href: "https://support.discord.com/hc/",
      dropdown: [
        { label: "Resources", items: ["Help Center", "Feedback", "Submit a Request"] }
      ],
      asset: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/31642d45-2dd0-494b-8925-fa25f0f82134-discord-com/assets/images/678a4b31695af76b1f713594_Discord_Nelly_Pose2_Flyin-3.webp"
    },
    {
      name: "Blog",
      href: "/blog",
      dropdown: [
        { label: "Collections", items: ["Featured", "Community", "Discord HQ", "Engineering & Developers", "How to Discord", "Policy & Safety", "Product & Features"] }
      ],
      asset: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/31642d45-2dd0-494b-8925-fa25f0f82134-discord-com/assets/images/678a4c12dbf6be5d792aa920_Clyde_20Cube-4.webp"
    },
    {
      name: "Developers",
      href: "/developers",
      dropdown: [
        { label: "Featured", items: ["Discord Social SDK", "Apps and Activities"] },
        { label: "Documentation", items: ["Developer Home", "Developer Documentation", "Developer Applications", "Developer Help Center", "Developer Newsletter"] }
      ],
      asset: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/31642d45-2dd0-494b-8925-fa25f0f82134-discord-com/assets/images/678a4aae3ee9f2e87506de82_Clyde_20_1_-5.webp"
    },
    { name: "Careers", href: "/careers" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
        isScrolled ? "backdrop-blur-discord py-4" : "bg-transparent py-4 text-white"
      }`}
    >
      <div className="container mx-auto px-10 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center">
          <img
            src="https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/66e90ab9506850e8a5dd48e3_Discrod_MainLogo.svg"
            alt="Discord"
            width={146}
            height={34}
            className="w-[124px] md:w-[146px] brightness-0 invert"
          />
        </a>

        {/* Center Desktop Links */}
        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <div key={link.name} className="group relative">
              <a
                href={link.href}
                className="flex items-center gap-1 text-[16px] font-semibold hover:underline decoration-2 underline-offset-4"
              >
                {link.name}
                {link.dropdown && <ChevronDown className="w-4 h-4" />}
              </a>

              {/* Dropdown Menu */}
              {link.dropdown && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-6 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200">
                  <div className="bg-[#23272A] border border-[#3F4147] rounded-[24px] p-8 min-w-[320px] shadow-2xl relative overflow-hidden">
                    <div className="flex gap-12 relative z-10">
                      {link.dropdown.map((group, idx) => (
                        <div key={idx} className="flex flex-col gap-4">
                          <span className="text-[#DBDEE1] text-[12px] font-bold uppercase tracking-wider">
                            {group.label}
                          </span>
                          <div className="flex flex-col gap-3">
                            {group.items.map((item) => (
                              <a
                                key={item}
                                href="#"
                                className="text-white text-[16px] font-medium hover:text-[#5865F2] whitespace-nowrap"
                              >
                                {item}
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {link.asset && (
                      <img
                        src={link.asset}
                        alt=""
                        className="absolute bottom-0 right-0 w-32 h-32 object-contain opacity-50 select-none pointer-events-none translate-x-4 translate-y-4"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Right Buttons */}
        <div className="flex items-center gap-4">
          <a
            href="https://discord.com/login"
            className="bg-white text-[#23272A] px-4 py-2 rounded-full text-[14px] font-medium hover:text-[#5865F2] transition-colors whitespace-nowrap"
          >
            Log In
          </a>
          <button
            className="lg:hidden text-white p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-0 bg-[#23272A] z-[110] p-10 lg:hidden transition-transform duration-300 ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex justify-between items-center mb-10">
          <img
            src="https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/66e278299a53f5bf88615e90_Symbol.svg"
            alt="Discord"
            width={34}
            height={34}
          />
          <button onClick={() => setMobileMenuOpen(false)}>
            <X size={32} className="text-white" />
          </button>
        </div>
        <nav className="flex flex-col gap-6">
          {navLinks.map((link) => (
            <div key={link.name} className="flex flex-col">
              <a
                href={link.href}
                className="text-white text-[20px] font-semibold flex items-center justify-between"
              >
                {link.name}
              </a>
              {link.dropdown && (
                <div className="mt-4 pl-4 flex flex-col gap-3 border-l-2 border-[#3F4147]">
                  {link.dropdown.flatMap(g => g.items).slice(0, 3).map((item) => (
                    <a key={item} href="#" className="text-[#DBDEE1] text-[16px]">
                      {item}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="absolute bottom-10 left-10 right-10">
          <a
            href="/download"
            className="w-full block text-center bg-[#5865F2] text-white py-4 rounded-full font-medium mb-4"
          >
            Download
          </a>
        </div>
      </div>
    </header>
  );
};

export default Navigation;