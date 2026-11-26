import type { SVGProps } from "react";

type LogoProps = SVGProps<SVGSVGElement>;

/**
 * 1. HR Policy Assistant
 * Deep ocean blue shield with golden verification star and document lines
 */
export function LogoHRPolicy({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="hrGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#hrGrad)" />
      {/* Document */}
      <rect x="8" y="7" width="16" height="18" rx="2" fill="#FFFFFF" fillOpacity="0.95" />
      <path d="M11 11H21M11 15H19M11 19H16" stroke="#2563EB" strokeWidth="1.75" strokeLinecap="round" />
      {/* Golden check badge */}
      <circle cx="21" cy="21" r="5" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.5" />
      <path d="M19 21L20.5 22.5L23 19.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 2. Ship Spares Specialist
 * Marine cyan/teal helm and anchor with brass gear accent
 */
export function LogoShipSpares({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="shipGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06B6D4" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#shipGrad)" />
      {/* Anchor & ring */}
      <circle cx="16" cy="11" r="3" stroke="#FFFFFF" strokeWidth="2" />
      <path d="M16 14V24M12 17H20" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 20C9 24.5 23 24.5 23 20" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="24" r="1.5" fill="#FDE047" />
    </svg>
  );
}

/**
 * 3. Content Creator
 * Sunset amber/orange gradient with creative quill and sparkling ink
 */
export function LogoContentCreator({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="contentGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#contentGrad)" />
      {/* Quill / Pen */}
      <path
        d="M23 7C23 7 19.5 12 15 15C13.5 16 12 18.5 10 23C13.5 21 16 19.5 17 18C20 13.5 25 10 25 10L23 7Z"
        fill="#FFFFFF"
      />
      <circle cx="9" cy="24" r="2" fill="#FDE047" />
      <path d="M21 15L17 19" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" />
      {/* Magic stars */}
      <path d="M8 9L9 11L11 12L9 13L8 15L7 13L5 12L7 11L8 9Z" fill="#FEF08A" />
    </svg>
  );
}

/**
 * 4. Image Prompt Engineer
 * Sky blue gradient with 3D camera lens and rainbow reflection
 */
export function LogoImagePrompt({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="camGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#camGrad)" />
      {/* Camera Body */}
      <rect x="6" y="11" width="20" height="14" rx="3" fill="#FFFFFF" />
      <path d="M12 8H20L21.5 11H10.5L12 8Z" fill="#E2E8F0" />
      {/* Lens */}
      <circle cx="16" cy="18" r="4.5" fill="#1E293B" />
      <circle cx="16" cy="18" r="3" fill="#38BDF8" />
      <circle cx="15" cy="17" r="1" fill="#FFFFFF" />
      <circle cx="22" cy="13.5" r="1" fill="#EF4444" />
    </svg>
  );
}

/**
 * 5. Visual Storyteller
 * Royal violet gradient with open storybook and glowing idea bulb
 */
export function LogoVisualStory({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="storyGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#storyGrad)" />
      {/* Open Book */}
      <path d="M16 14C13 12 8 12.5 6 13V23C8 22.5 13 22 16 24V14Z" fill="#F8FAFC" />
      <path d="M16 14C19 12 24 12.5 26 13V23C24 22.5 19 22 16 24V14Z" fill="#EDE9FE" />
      {/* Floating Sparkle / Star */}
      <path d="M16 6L17.5 9.5L21 11L17.5 12.5L16 16L14.5 12.5L11 11L14.5 9.5L16 6Z" fill="#FDE047" />
    </svg>
  );
}

/**
 * 6. Short-Video Editing Coach
 * Emerald & teal clapperboard with colorful timeline playback
 */
export function LogoVideoCoach({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="videoGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#videoGrad)" />
      {/* Clapperboard Body */}
      <rect x="7" y="13" width="18" height="12" rx="2" fill="#FFFFFF" />
      {/* Play button */}
      <path d="M14 16L19 19L14 22V16Z" fill="#10B981" />
      {/* Slanted clapper top */}
      <path d="M6 10H26L24 7H8L6 10Z" fill="#064E3B" />
      <path d="M11 7L9 10M17 7L15 10M23 7L21 10" stroke="#FDE047" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * 7. Frontend Developer
 * Rose/pink gradient with dark code terminal and rainbow tags
 */
export function LogoFrontendDev({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="feGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F43F5E" />
          <stop offset="1" stopColor="#BE123C" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#feGrad)" />
      {/* Terminal Window */}
      <rect x="6" y="8" width="20" height="16" rx="2.5" fill="#1E293B" />
      <circle cx="9.5" cy="11.5" r="1" fill="#EF4444" />
      <circle cx="12.5" cy="11.5" r="1" fill="#F59E0B" />
      <circle cx="15.5" cy="11.5" r="1" fill="#10B981" />
      {/* Code brackets */}
      <path d="M12 16L9.5 18L12 20M20 16L22.5 18L20 20M17 15L15 21" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 8. Corporate Training Designer
 * Violet & purple gradient with academic cap and gold tassel
 */
export function LogoTrainingDesigner({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="trainGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#trainGrad)" />
      {/* Graduation Cap Diamond */}
      <path d="M16 8L26 13L16 18L6 13L16 8Z" fill="#FFFFFF" />
      {/* Skullcap */}
      <path d="M10 16.5V20.5C10 22.5 12.5 24 16 24C19.5 24 22 22.5 22 20.5V16.5" fill="#EDE9FE" />
      {/* Golden Tassel */}
      <path d="M23 14.5V20.5" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="23" cy="21" r="1" fill="#FDE047" />
    </svg>
  );
}

/**
 * 9. Pitch Deck Builder
 * Indigo & cyan rising trend chart with golden rocket
 */
export function LogoPitchDeck({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="pitchGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#312E81" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#pitchGrad)" />
      {/* Rising Bar Chart */}
      <rect x="7" y="18" width="3.5" height="6" rx="1" fill="#818CF8" />
      <rect x="12" y="14" width="3.5" height="10" rx="1" fill="#38BDF8" />
      <rect x="17" y="10" width="3.5" height="14" rx="1" fill="#22C55E" />
      {/* Rocket / Arrow */}
      <path d="M21 8L25 7L24 11M25 7L13 18" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 10. Study Abroad Advisor
 * Amber & gold gradient with orbital globe and passport stamp
 */
export function LogoStudyAbroad({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="abroadGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#abroadGrad)" />
      {/* Globe */}
      <circle cx="16" cy="16" r="7.5" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1.5" />
      <path d="M8.5 16H23.5M16 8.5C18.5 11 19.5 13.5 19.5 16C19.5 18.5 18.5 21 16 23.5C13.5 21 12.5 18.5 12.5 16C12.5 13.5 13.5 11 16 8.5Z" stroke="#FFFFFF" strokeWidth="1.2" />
      {/* Orbit ring */}
      <path d="M7 21C11 25 21 25 25 21" stroke="#FDE047" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 11. Growth Ads Operator
 * Coral red & fiery orange megaphone with targeting radar
 */
export function LogoGrowthAds({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="growthGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EF4444" />
          <stop offset="1" stopColor="#C2410C" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#growthGrad)" />
      {/* Megaphone */}
      <path d="M8 15V19H11L16 22V12L11 15H8Z" fill="#FFFFFF" />
      <path d="M10 19V23H13V19" fill="#E2E8F0" />
      {/* Growth sound waves */}
      <path d="M19 14C20.5 15.5 20.5 18.5 19 20" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 11C25 14 25 20 22 23" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 12. Bug Analysis Agent
 * Mint & emerald green cybernetic beetle with radar scanner
 */
export function LogoBugAnalysis({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="bugGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#065F46" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#bugGrad)" />
      {/* Bug Body */}
      <ellipse cx="16" cy="18" rx="5.5" ry="6.5" fill="#FFFFFF" />
      <path d="M16 11.5V24.5M10.5 18H21.5" stroke="#10B981" strokeWidth="1.5" />
      {/* Bug Head */}
      <path d="M13 12C13 10.5 14.5 9 16 9C17.5 9 19 10.5 19 12H13Z" fill="#34D399" />
      {/* Antennae */}
      <path d="M14 9L11 6M18 9L21 6" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
      {/* Legs */}
      <path d="M11 15L7 14M21 15L25 14M11 20L7 22M21 20L25 22" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 13. Data Engineer
 * Cyan & cobalt 3D tiered data pipeline with glowing nodes
 */
export function LogoDataEngineer({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="dataGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06B6D4" />
          <stop offset="1" stopColor="#1E40AF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#dataGrad)" />
      {/* Top Cylinder */}
      <ellipse cx="16" cy="10" rx="8" ry="3" fill="#FFFFFF" />
      <path d="M8 10V14C8 15.65 11.58 17 16 17C20.42 17 24 15.65 24 14V10" stroke="#FFFFFF" strokeWidth="1.5" fill="#38BDF8" />
      {/* Middle Cylinder */}
      <path d="M8 16V20C8 21.65 11.58 23 16 23C20.42 23 24 21.65 24 20V16" stroke="#FFFFFF" strokeWidth="1.5" fill="#0284C7" />
      {/* Data Pulse */}
      <circle cx="21" cy="18" r="1.5" fill="#FDE047" />
    </svg>
  );
}

/**
 * 14. AI Engineer
 * Deep cobalt & violet AI neural processor with golden pins
 */
export function LogoAIEngineer({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="aiGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#aiGrad)" />
      {/* Chip base */}
      <rect x="9" y="9" width="14" height="14" rx="2.5" fill="#1E1B4B" stroke="#818CF8" strokeWidth="1.5" />
      {/* Glowing Neural Core */}
      <rect x="13" y="13" width="6" height="6" rx="1.5" fill="#F43F5E" />
      {/* Golden Pins */}
      <path d="M12 6V9M16 6V9M20 6V9M12 23V26M16 23V26M20 23V26M6 12H9M6 16H9M6 20H9M23 12H26M23 16H26M23 20H26" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 15. Prompt Engineer
 * Electric magenta & purple flash with quantum lightning bolt
 */
export function LogoPromptEngineer({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="promptGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C026D3" />
          <stop offset="1" stopColor="#701A75" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#promptGrad)" />
      {/* Lightning Bolt */}
      <path d="M18 6L9 17H16L14 26L23 15H16L18 6Z" fill="#FDE047" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Sparkle halo */}
      <circle cx="23" cy="9" r="1.5" fill="#FFFFFF" />
      <circle cx="9" cy="22" r="1.2" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * 16. Model QA Specialist
 * Steel slate & emerald checklist with verified stamp
 */
export function LogoModelQA({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="qaGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#64748B" />
          <stop offset="1" stopColor="#334155" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#qaGrad)" />
      {/* Clipboard */}
      <rect x="8" y="8" width="16" height="18" rx="2" fill="#FFFFFF" />
      <rect x="12" y="6" width="8" height="4" rx="1.5" fill="#CBD5E1" />
      {/* Green Checks */}
      <path d="M11 13L13 15L16.5 11.5M11 18L13 20L16.5 16.5" stroke="#10B981" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 13H21M18 18H21" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 17. Treasury Policy Analyst
 * Emerald & gold banking temple facade with balance vault
 */
export function LogoTreasuryAnalyst({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="taxGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#064E3B" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#taxGrad)" />
      {/* Pediment */}
      <path d="M7 12L16 7L25 12H7Z" fill="#FDE047" />
      {/* Columns */}
      <rect x="9" y="13" width="2.5" height="8" rx="0.5" fill="#FFFFFF" />
      <rect x="14.75" y="13" width="2.5" height="8" rx="0.5" fill="#FFFFFF" />
      <rect x="20.5" y="13" width="2.5" height="8" rx="0.5" fill="#FFFFFF" />
      {/* Base */}
      <rect x="6" y="22" width="20" height="3" rx="1" fill="#FDE047" />
    </svg>
  );
}

/**
 * 18. Personal Growth Mentor
 * Pink & violet flourishing starburst and blooming lotus
 */
export function LogoGrowthMentor({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="mentorGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EC4899" />
          <stop offset="1" stopColor="#BE185D" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#mentorGrad)" />
      {/* Big Golden Sparkle */}
      <path d="M16 6L18.5 12.5L25 15L18.5 17.5L16 24L13.5 17.5L7 15L13.5 12.5L16 6Z" fill="#FDE047" />
      {/* Secondary White Sparkle */}
      <path d="M24 7L25 9.5L27.5 10.5L25 11.5L24 14L23 11.5L20.5 10.5L23 9.5L24 7Z" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * 19. Legal & Compliance Advisor
 * Deep navy & gold scales of justice
 */
export function LogoLegalCompliance({ className = "w-7 h-7", ...props }: LogoProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" {...props}>
      <defs>
        <linearGradient id="legalGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E3A8A" />
          <stop offset="1" stopColor="#172554" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#legalGrad)" />
      {/* Balance beam & pillar */}
      <path d="M16 8V24M11 24H21M8 11H24" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" />
      {/* Left scale */}
      <path d="M8 11L6 17H10L8 11Z" fill="#FFFFFF" />
      {/* Right scale */}
      <path d="M24 11L22 17H26L24 11Z" fill="#FFFFFF" />
    </svg>
  );
}
