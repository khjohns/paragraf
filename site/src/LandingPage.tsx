/**
 * Paragraf Landing Page
 *
 * Split layout with animated law lookup simulation on the left
 * and info card on the right.
 */

import { useEffect, useState, useMemo } from 'react';
import { Button } from './components/Button';
import {
  GitHubLogoIcon,
  HeartIcon,
  CheckCircledIcon,
  CopyIcon,
  InfoCircledIcon,
  ChevronDownIcon,
} from '@radix-ui/react-icons';

const MCP_URL = import.meta.env.VITE_MCP_URL || '';

// ============================================================================
// Law Lookup Simulation
// ============================================================================

function LawLookupSimulation() {
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);

  // Verified against actual MCP responses
  const simulations = useMemo(() => [
    // Simulation 1: Oppsigelse av leieforhold
    [
      { type: 'question' as const, content: 'Kan utleier si meg opp?' },
      { type: 'search' as const, content: 'Søker "oppsigelse leie"...' },
      { type: 'results' as const, content: '4 treff: husleieloven §§ 9-7, 9-8, 11-2, 11-3' },
      { type: 'fetch' as const, content: 'Henter § 9-7...' },
      { type: 'law' as const, content: '§ 9-7 Formkrav til utleierens oppsigelse\n\nOppsigelse fra utleier skal være skriftlig.\n\nOppsigelsen skal begrunnes. Oppsigelsen skal også opplyse om at leieren kan protestere skriftlig til utleieren innen én måned...' },
    ],
    // Simulation 2: Prisavslag ved mangel
    [
      { type: 'question' as const, content: 'Boligen har feil - hva kan jeg kreve?' },
      { type: 'search' as const, content: 'Søker "prisavslag mangel"...' },
      { type: 'results' as const, content: '4 treff: avhendingslova § 4-12, buofl § 33, ...' },
      { type: 'fetch' as const, content: 'Henter avhendingslova § 4-12...' },
      { type: 'law' as const, content: '§ 4-12 Prisavslag\n\n(1) Har eigedomen ein mangel, kan kjøparen krevje eit forholdsmessig prisavslag.\n\n(2) Med mindre noko anna vert godtgjort, skal prisavslaget fastsetjast til kostnadene ved å få mangelen retta.' },
    ],
    // Simulation 3: Midlertidig ansettelse
    [
      { type: 'question' as const, content: 'Er midlertidig ansettelse lovlig?' },
      { type: 'search' as const, content: 'Søker "midlertidig ansettelse"...' },
      { type: 'results' as const, content: '5 treff: aml § 14-9, statsansatteloven § 9, ...' },
      { type: 'fetch' as const, content: 'Henter aml § 14-9...' },
      { type: 'law' as const, content: '§ 14-9 Fast og midlertidig ansettelse\n\n(1) Arbeidstaker skal ansettes fast. Med fast ansettelse menes i denne lov at ansettelsen er løpende og tidsubegrenset...' },
    ],
    // Simulation 4: Miljøkrav i offentlige anskaffelser (OR-søk)
    [
      { type: 'question' as const, content: 'Må offentlige innkjøp ta miljøhensyn?' },
      { type: 'search' as const, content: 'Søker "miljø OR klima"...' },
      { type: 'results' as const, content: '5 treff: anskaffelsesforskriften § 7-9, aml § 3-1, ...' },
      { type: 'fetch' as const, content: 'Henter anskaffelsesforskriften § 7-9...' },
      { type: 'law' as const, content: '§ 7-9 Klima- og miljøhensyn i offentlige anskaffelser\n\n(1) Krav og kriterier etter denne bestemmelsen skal ha som mål å redusere anskaffelsens samlede klimaavtrykk eller miljøbelastning.\n\n(2) Oppdragsgiver skal vekte klima- og miljøhensyn med minimum tretti prosent.' },
    ],
  ], []);

  const currentSim = simulations[cycle % simulations.length];
  const steps = currentSim;

  useEffect(() => {
    if (step < steps.length) {
      const delays = [400, 800, 1000, 600, 800];
      const timeout = setTimeout(() => {
        setStep(s => s + 1);
      }, delays[step] || 800);
      return () => clearTimeout(timeout);
    } else {
      const resetTimeout = setTimeout(() => {
        setStep(0);
        setCycle(c => c + 1);
      }, 4000);
      return () => clearTimeout(resetTimeout);
    }
  }, [step, steps.length]);

  return (
    <div className="text-sm h-80 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10 flex-shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
        </div>
        <span className="text-xs text-white/40 ml-2">paragraf</span>
      </div>

      {/* Content area - fixed height with scroll */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {step >= 1 && (
          <div className="animate-fade-in">
            <span className="text-white">{steps[0].content}</span>
          </div>
        )}

        {step >= 2 && (
          <div className="flex gap-2 text-white/50 text-xs animate-fade-in">
            <span className="text-pkt-brand-green-1000">●</span>
            {steps[1].content}
          </div>
        )}

        {step >= 3 && (
          <div className="flex gap-2 text-white/50 text-xs animate-fade-in">
            <span className="text-pkt-brand-green-1000">●</span>
            {steps[2].content}
          </div>
        )}

        {step >= 4 && (
          <div className="flex gap-2 text-white/50 text-xs animate-fade-in">
            <span className="text-pkt-brand-green-1000">●</span>
            {steps[3].content}
          </div>
        )}

        {step >= 5 && (
          <div className="p-3 rounded bg-white/5 border border-white/10 animate-fade-in">
            <div className="text-white/90 whitespace-pre-wrap leading-relaxed text-xs">
              {steps[4].content}
            </div>
          </div>
        )}

        {step > 0 && step < steps.length && (
          <div className="flex gap-1 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Copyable URL
// ============================================================================

function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-pkt-bg-subtle rounded-lg border border-pkt-border-subtle">
      <code className="flex-1 text-xs font-mono text-pkt-text-body-default truncate">
        {url}
      </code>
      <button
        onClick={handleCopy}
        className="p-2 sm:p-1.5 rounded hover:bg-white transition-colors flex-shrink-0"
        title="Kopier"
      >
        {copied ? (
          <CheckCircledIcon className="w-4 h-4 text-pkt-brand-dark-green-1000" />
        ) : (
          <CopyIcon className="w-4 h-4 text-pkt-text-body-subtle" />
        )}
      </button>
    </div>
  );
}

// ============================================================================
// MCP Tooltip
// ============================================================================

function McpTooltip() {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center align-middle ml-1 text-pkt-text-body-subtle hover:text-pkt-text-body-dark transition-colors"
        aria-label="Hva er MCP?"
      >
        <InfoCircledIcon className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 text-xs text-pkt-text-body-dark bg-pkt-bg-card rounded-lg border border-pkt-border-subtle shadow-lg z-10">
          <strong>MCP</strong> (Model Context Protocol) er en åpen standard som lar
          KI-assistenter slå opp informasjon fra pålitelige kilder. Paragraf henter
          kun lovtekst fra Lovdata – ingen persondata behandles.
        </span>
      )}
    </span>
  );
}

// ============================================================================
// Privacy Dialog
// ============================================================================

function PrivacyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-pkt-bg-card rounded-lg border border-pkt-border-subtle shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-pkt-text-body-dark">Personvern</h2>
          <button onClick={onClose} className="text-pkt-text-body-subtle hover:text-pkt-text-body-dark text-xl leading-none">&times;</button>
        </div>
        <div className="space-y-3 text-xs text-pkt-text-body-subtle leading-relaxed">
          <p>
            <strong className="text-pkt-text-body-dark">Ingen sporing.</strong>{' '}
            Paragraf bruker ingen informasjonskapsler (cookies), analyseverktøy eller sporings&shy;teknologi.
          </p>
          <p>
            <strong className="text-pkt-text-body-dark">Ingen registrering.</strong>{' '}
            Tjenesten er gratis og krever ingen brukerkonto. Alle oppslag er anonyme.
          </p>
          <p>
            <strong className="text-pkt-text-body-dark">Rate limiting.</strong>{' '}
            IP-adresser brukes midlertidig i minnet for å begrense antall forespørsler.
            De lagres ikke permanent og slettes ved omstart av tjenesten.
          </p>
          <p>
            <strong className="text-pkt-text-body-dark">Lovdata.</strong>{' '}
            All lovtekst hentes fra{' '}
            <a href="https://lovdata.no" className="underline hover:text-pkt-text-body-dark" target="_blank" rel="noopener noreferrer">Lovdata</a>
            {' '}og er offentlig tilgjengelig under NLOD 2.0.
          </p>
          <p>
            <strong className="text-pkt-text-body-dark">Vipps.</strong>{' '}
            Donasjonsknappen lenker til Vipps MobilePay AS. Paragraf mottar eller behandler
            ingen betalingsinformasjon.
          </p>
          <p>
            <strong className="text-pkt-text-body-dark">Infrastruktur.</strong>{' '}
            Nettsiden hostes på GitHub Pages og API-et på Render. Disse tjenestene
            kan logge IP-adresser i henhold til sine egne personvernerklæringer.
          </p>
          <p>
            <strong className="text-pkt-text-body-dark">Kontakt.</strong>{' '}
            Spørsmål om personvern kan rettes til{' '}
            <a href="https://github.com/khjohns/paragraf/issues" className="underline hover:text-pkt-text-body-dark" target="_blank" rel="noopener noreferrer">GitHub</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tools Accordion
// ============================================================================

const toolGroups = [
  {
    title: 'Søk i lovverket',
    tools: 'sok · semantisk_sok',
    description: 'Fulltekstsøk og KI-søk med filtre for departement, rettsområde og dokumenttype',
  },
  {
    title: 'Hent lovtekst',
    tools: 'lov · forskrift · hent_flere',
    description: 'Slå opp enkeltparagrafer eller hent flere samtidig',
  },
  {
    title: 'Utforsk sammenhenger',
    tools: 'relaterte_forskrifter · sjekk_storrelse',
    description: 'Finn relaterte forskrifter og estimer kontekstbruk før store oppslag',
  },
  {
    title: 'Filterverdier',
    tools: 'departementer · rettsomrader · liste',
    description: 'List tilgjengelige departementer, rettsområder og lover',
  },
];

function ToolsAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 sm:mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-pkt-text-body-subtle hover:text-pkt-text-body-dark transition-colors"
      >
        <ChevronDownIcon
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
        />
        <span>11 verktøy tilgjengelig</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 animate-fade-in">
          {toolGroups.map((group) => (
            <div key={group.title} className="p-3 rounded-lg bg-pkt-bg-subtle border border-pkt-border-subtle">
              <span className="text-xs font-medium text-pkt-text-body-dark">{group.title}</span>
              <p className="text-xs text-pkt-text-body-subtle leading-relaxed">{group.description}</p>
              <code className="text-xs text-pkt-text-body-subtle font-mono">{group.tools}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Info Card
// ============================================================================

function InfoCard() {
  return (
    <div className="bg-pkt-bg-card rounded-lg border border-pkt-grays-gray-200 shadow-xl shadow-pkt-brand-dark-blue-1000/5 p-5 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <svg viewBox="0 0 120 120" className="w-12 h-12" aria-label="Paragraf logo">
          <defs>
            <clipPath id="logo-l"><rect x="0" y="0" width="60" height="120"/></clipPath>
            <clipPath id="logo-r"><rect x="60" y="0" width="60" height="120"/></clipPath>
          </defs>
          <rect width="120" height="120" rx="20" fill="#1B2A4A"/>
          <g clipPath="url(#logo-l)" transform="translate(-3, -3)">
            <text x="60" y="82" fontFamily="Georgia, 'Times New Roman', serif" fontSize="72" fontWeight="700" fill="white" textAnchor="middle">§</text>
          </g>
          <g clipPath="url(#logo-r)" transform="translate(3, 3)">
            <text x="60" y="82" fontFamily="Georgia, 'Times New Roman', serif" fontSize="72" fontWeight="700" fill="#4ADE80" textAnchor="middle">§</text>
          </g>
        </svg>
        <div>
          <h1 className="text-xl font-bold text-pkt-text-body-dark">Paragraf</h1>
          <p className="text-sm text-pkt-text-body-subtle">Norsk lov for KI</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-3 sm:p-4 rounded-lg bg-pkt-bg-subtle mb-4 sm:mb-6">
        <div className="text-center">
          <div className="text-lg font-bold text-pkt-text-body-dark">770</div>
          <div className="text-xs text-pkt-text-body-subtle">Lover</div>
        </div>
        <div className="text-center border-x border-pkt-border-subtle">
          <div className="text-lg font-bold text-pkt-text-body-dark">3 600</div>
          <div className="text-xs text-pkt-text-body-subtle">Forskrifter</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-pkt-text-body-dark">92k</div>
          <div className="text-xs text-pkt-text-body-subtle">Paragrafer</div>
        </div>
      </div>

      {/* How to connect */}
      <div className="mb-4 sm:mb-6">
        <p className="text-sm font-medium text-pkt-text-body-dark mb-1.5 sm:mb-2">
          Koble til din KI-assistent via MCP<McpTooltip />
        </p>
        <p className="text-xs text-pkt-text-body-subtle mb-3">
          Kopier adressen og legg til som MCP-kobling under innstillinger i din KI-assistent.
        </p>
        {MCP_URL && (
          <CopyableUrl url={MCP_URL} />
        )}
      </div>

      {/* Tools */}
      <ToolsAccordion />

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href="https://github.com/khjohns/paragraf"
          className="flex-1"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="secondary" size="md" className="w-full">
            <span className="flex items-center justify-center gap-2">
              <GitHubLogoIcon className="w-4 h-4" />
              Kildekode
            </span>
          </Button>
        </a>
        <a
          href="https://qr.vipps.no/box/TODO"
          className="flex-1"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="secondary" size="md" className="w-full">
            <span className="flex items-center justify-center gap-2">
              <HeartIcon className="w-4 h-4" />
              Vipps
            </span>
          </Button>
        </a>
      </div>

      {/* Supported clients */}
      <div className="mt-4 pt-4 sm:mt-6 sm:pt-6 border-t border-pkt-border-subtle">
        <p className="text-xs text-pkt-text-body-subtle mb-2">Støtter MCP</p>
        <div className="flex flex-wrap gap-2">
          {['Claude', 'ChatGPT Plus', 'Gemini CLI', 'Copilot Studio'].map((client) => (
            <span
              key={client}
              className="px-3 py-1 text-xs text-pkt-text-body-subtle bg-pkt-bg-subtle rounded-full border border-pkt-border-subtle"
            >
              {client}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-pkt-bg-subtle flex relative overflow-hidden">
      {/* Mobile background accent */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-[0.07] blur-3xl pointer-events-none lg:hidden"
        style={{ background: 'radial-gradient(ellipse, var(--color-pkt-brand-blue-1000) 0%, transparent 70%)' }}
      />
      {/* Left side - Simulation only (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-pkt-brand-dark-blue-1000 relative overflow-hidden items-center justify-center">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Gradient accents */}
        <div
          className="absolute top-0 right-0 w-96 h-96 opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-pkt-brand-blue-1000) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-80 h-80 opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-pkt-brand-green-1000) 0%, transparent 70%)' }}
        />

        {/* Terminal simulation - centered */}
        <div
          className={`relative z-10 w-full max-w-2xl px-12 xl:px-16 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
          }`}
        >
          <div className="bg-black/30 backdrop-blur-sm rounded-lg border border-white/10 p-6">
            <LawLookupSimulation />
          </div>
        </div>
      </div>

      {/* Right side - Info card */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-start lg:items-center justify-center p-6 pt-10 pb-10 sm:p-8 sm:pt-12 sm:pb-12 lg:pt-8 lg:pb-8">
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <InfoCard />

          {/* Footer */}
          <p className="mt-4 sm:mt-6 text-center text-xs text-pkt-text-body-subtle">
            Gratis og åpen kildekode ·{' '}
            <a href="https://github.com/sponsors/khjohns" className="hover:underline" target="_blank" rel="noopener noreferrer">Støtt via GitHub</a>
            {' '}· Data fra{' '}
            <a href="https://lovdata.no" className="hover:underline">Lovdata</a>
            {' '}(NLOD 2.0)
          </p>
          <p className="mt-2 text-center text-xs text-pkt-text-body-subtle">
            <button onClick={() => setPrivacyOpen(true)} className="hover:underline">Personvern</button>
          </p>
        </div>
      </div>
      <PrivacyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}

export default LandingPage;
