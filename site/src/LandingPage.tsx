/**
 * Paragraf Landing Page
 *
 * Split layout with animated law lookup simulation on the left
 * and info card on the right. "Se eksempler" transitions the left
 * panel from terminal to a readable examples view.
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
  ArrowLeftIcon,
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
// Guide Panel (replaces left side when "Mer informasjon" is clicked)
// ============================================================================

const examples = [
  {
    question: 'Hva sier loven om prøvetid?',
    tag: 'Direkte oppslag',
    how: 'Paragraf slår opp arbeidsmiljøloven § 15-6 direkte og returnerer lovteksten.',
    tool: 'lov("aml", "15-6")',
    result:
      '§ 15-6 Oppsigelsesvern i arbeidsavtaler med bestemt prøvetid\n\n' +
      'Blir arbeidstaker som skriftlig er ansatt på en bestemt prøvetid, sagt opp, ' +
      'må oppsigelsen være begrunnet i arbeidstakers tilpasning til arbeidet, ' +
      'faglige dyktighet eller pålitelighet.',
  },
  {
    question: 'Hvilke lover regulerer personvern?',
    tag: 'Fulltekstsøk',
    how: 'Paragraf søker på tvers av alle 92 000 paragrafer og finner relevante treff i flere lover.',
    tool: 'sok("personvern")',
    result:
      'Finner treff i personopplysningsloven (GDPR), helseregisterloven, ' +
      'politiregisterloven, pasientjournalloven m.fl. — med lenke til hver paragraf ' +
      'slik at du kan lese videre.',
  },
  {
    question: 'What are the rules if I discover hidden defects after buying a house?',
    tag: 'KI-søk',
    how: 'KI-søk forstår spørsmål på tvers av språk. Et engelsk spørsmål om «hidden defects» ' +
      'matcher «mangel» i norsk lovtekst.',
    tool: 'semantisk_sok("skjulte feil ved boligkjøp")',
    result:
      'Finner avhendingslova § 4-12 om prisavslag og § 3-9 om «som den er»-forbehold, ' +
      'selv om brukeren ikke kjenner de juridiske termene.',
  },
];

const setupSteps = [
  {
    client: 'Claude.ai',
    steps: 'Settings \u2192 Integrations \u2192 Add MCP server \u2192 lim inn URL',
  },
  {
    client: 'Claude Code',
    steps: 'claude mcp add paragraf https://api.paragraf.dev/mcp/paragraf/',
  },
  {
    client: 'ChatGPT Plus',
    steps: 'Settings \u2192 Connectors \u2192 Add connector \u2192 lim inn URL',
  },
  {
    client: 'Cursor / Windsurf',
    steps: 'Legg til i MCP-config med type "streamable-http" og URL',
  },
];

function GuidePanel({ onBack }: { onBack: () => void }) {
  const [expandedExample, setExpandedExample] = useState<number | null>(null);

  return (
    <div className="w-full max-w-xl mx-auto px-8 xl:px-12 py-12">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-pkt-text-body-subtle hover:text-pkt-text-body-dark transition-colors mb-10"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>Tilbake</span>
      </button>

      {/* Section 1: What is Paragraf */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-pkt-text-body-dark mb-3">
          Hva er Paragraf?
        </h2>
        <p className="text-sm text-pkt-text-body-default leading-relaxed mb-3">
          Paragraf gir KI-assistenter direkte tilgang til 92 000+ paragrafer
          fra norsk lov og forskrift via Lovdata. I stedet for å gjette
          juridiske referanser kan assistenten slå opp eksakt lovtekst
          — og gi presise, kildebaserte svar.
        </p>
        <p className="text-sm text-pkt-text-body-default leading-relaxed">
          Nyttig for alle som jobber med norsk lov: jurister, offentlig sektor,
          næringsliv, studenter og privatpersoner. Tjenesten er gratis og
          åpen kildekode.
        </p>
      </section>

      {/* Section 2: What is MCP */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-pkt-text-body-dark mb-3">
          Hva er MCP?
        </h2>
        <p className="text-sm text-pkt-text-body-default leading-relaxed mb-3">
          <strong>MCP</strong> (Model Context Protocol) er en åpen standard som lar
          KI-assistenter slå opp informasjon fra pålitelige kilder. Tenk på det
          som et oppslagsverk assistenten kan bruke underveis i samtalen.
        </p>
        <p className="text-sm text-pkt-text-body-default leading-relaxed mb-3">
          Uten MCP må assistenten basere seg på det den «husker» fra treningen,
          som kan være utdatert eller upresist. Med Paragraf koblet til kan den
          hente den gjeldende lovteksten der og da.
        </p>
        <div className="p-4 rounded-lg bg-white border border-pkt-border-subtle">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded bg-pkt-bg-subtle flex items-center justify-center flex-shrink-0 text-sm">
              ?
            </div>
            <div className="flex-1">
              <div className="text-xs text-pkt-text-body-subtle mb-1">Du spør</div>
              <div className="text-sm text-pkt-text-body-dark">"Hva sier loven om oppsigelse?"</div>
            </div>
          </div>
          <div className="ml-11 my-2 border-l-2 border-pkt-border-subtle h-4" />
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded bg-pkt-bg-subtle flex items-center justify-center flex-shrink-0 text-sm font-mono">
              §
            </div>
            <div className="flex-1">
              <div className="text-xs text-pkt-text-body-subtle mb-1">Assistenten bruker Paragraf</div>
              <div className="text-sm text-pkt-text-body-dark">Slår opp arbeidsmiljøloven § 15-3 og svarer med eksakt lovtekst</div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Getting started */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-pkt-text-body-dark mb-3">
          Kom i gang
        </h2>
        <p className="text-sm text-pkt-text-body-default leading-relaxed mb-4">
          Kopier adressen under og legg den til i din KI-assistent.
          Ingen registrering eller API-nøkkel kreves.
        </p>

        {MCP_URL && (
          <div className="mb-4">
            <CopyableUrl url={MCP_URL} />
          </div>
        )}

        <div className="space-y-2">
          {setupSteps.map((s) => (
            <div key={s.client} className="p-3 rounded-lg bg-white border border-pkt-border-subtle">
              <span className="text-xs font-medium text-pkt-text-body-dark">{s.client}</span>
              <p className="text-xs text-pkt-text-body-subtle mt-0.5 font-mono">{s.steps}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Examples */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-pkt-text-body-dark mb-3">
          Eksempler
        </h2>
        <p className="text-sm text-pkt-text-body-default leading-relaxed mb-4">
          Tre typiske bruksmåter — klikk for å se hva som skjer bak kulissene.
        </p>

        <div className="space-y-3">
          {examples.map((ex, i) => {
            const isExpanded = expandedExample === i;
            return (
              <div
                key={i}
                className="rounded-lg border border-pkt-border-subtle bg-white overflow-hidden transition-shadow hover:shadow-md"
              >
                <button
                  onClick={() => setExpandedExample(isExpanded ? null : i)}
                  className="w-full flex items-start gap-3 p-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-pkt-bg-subtle text-pkt-text-body-subtle border border-pkt-border-subtle">
                        {ex.tag}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-pkt-text-body-dark leading-snug">
                      «{ex.question}»
                    </span>
                  </div>
                  <ChevronDownIcon
                    className={`w-4 h-4 mt-1 flex-shrink-0 text-pkt-text-body-subtle transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 animate-fade-in">
                    <div className="space-y-3">
                      <p className="text-xs text-pkt-text-body-subtle leading-relaxed">
                        {ex.how}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-pkt-brand-dark-green-1000 font-mono">{'>'}</span>
                        <code className="font-mono text-pkt-text-body-default">{ex.tool}</code>
                      </div>
                      <div className="p-3 rounded bg-pkt-bg-subtle text-xs text-pkt-text-body-default leading-relaxed whitespace-pre-line">
                        {ex.result}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 5: What's available */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-pkt-text-body-dark mb-3">
          Hva er tilgjengelig?
        </h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-white border border-pkt-border-subtle text-center">
            <div className="text-lg font-bold text-pkt-text-body-dark">770</div>
            <div className="text-xs text-pkt-text-body-subtle">Lover</div>
          </div>
          <div className="p-3 rounded-lg bg-white border border-pkt-border-subtle text-center">
            <div className="text-lg font-bold text-pkt-text-body-dark">3 600</div>
            <div className="text-xs text-pkt-text-body-subtle">Forskrifter</div>
          </div>
          <div className="p-3 rounded-lg bg-white border border-pkt-border-subtle text-center">
            <div className="text-lg font-bold text-pkt-text-body-dark">92k</div>
            <div className="text-xs text-pkt-text-body-subtle">Paragrafer</div>
          </div>
        </div>
        <p className="text-sm text-pkt-text-body-default leading-relaxed mb-3">
          Paragraf dekker alle gjeldende norske lover og sentrale forskrifter
          fra Lovdata sitt åpne API. Dataene oppdateres daglig.
        </p>
        <div className="p-4 rounded-lg bg-white border border-pkt-border-subtle">
          <p className="text-xs font-medium text-pkt-text-body-dark mb-2">
            Ikke tilgjengelig
          </p>
          <ul className="text-xs text-pkt-text-body-subtle space-y-1">
            <li>Rettsavgjørelser (Høyesterett, lagmannsrett, tingrett)</li>
            <li>Forarbeider (NOU, Prop., Ot.prp.)</li>
            <li>Juridiske artikler og kommentarutgaver</li>
            <li>Lokale forskrifter</li>
          </ul>
          <p className="text-xs text-pkt-text-body-subtle mt-2">
            For disse kildene, se{' '}
            <a href="https://lovdata.no" className="underline hover:text-pkt-text-body-dark" target="_blank" rel="noopener noreferrer">lovdata.no</a>.
          </p>
        </div>
      </section>

      {/* Section 6: Data source */}
      <section>
        <h2 className="text-lg font-bold text-pkt-text-body-dark mb-3">
          Om dataene
        </h2>
        <p className="text-sm text-pkt-text-body-default leading-relaxed mb-3">
          All lovtekst hentes fra{' '}
          <a href="https://lovdata.no" className="underline hover:text-pkt-text-body-dark" target="_blank" rel="noopener noreferrer">Lovdata</a>
          {' '}og er offentlig tilgjengelig under{' '}
          <a href="https://data.norge.no/nlod/no/2.0" className="underline hover:text-pkt-text-body-dark" target="_blank" rel="noopener noreferrer">NLOD 2.0</a>
          {' '}(Norsk lisens for offentlige data).
        </p>
        <p className="text-sm text-pkt-text-body-default leading-relaxed">
          Paragraf er et uavhengig prosjekt med åpen kildekode.
          Spørsmål eller feil kan rapporteres på{' '}
          <a href="https://github.com/khjohns/paragraf/issues" className="underline hover:text-pkt-text-body-dark" target="_blank" rel="noopener noreferrer">GitHub</a>.
        </p>
      </section>
    </div>
  );
}

// Mobile overlay for guide (left panel is hidden on mobile)
function GuideOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-pkt-bg-subtle overflow-y-auto lg:hidden">
      <GuidePanel onBack={onClose} />
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
        className="flex items-center gap-1.5 py-2 text-xs text-pkt-text-body-subtle hover:text-pkt-text-body-dark transition-colors"
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

function InfoCard({ onShowGuide }: { onShowGuide: () => void }) {
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

      {/* Guide link */}
      <button
        onClick={onShowGuide}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm text-pkt-text-body-subtle hover:text-pkt-text-body-dark border border-pkt-border-subtle hover:border-pkt-grays-gray-300 rounded-lg transition-colors"
      >
        <InfoCircledIcon className="w-4 h-4" />
        Mer informasjon
      </button>

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
  const [showExamples, setShowExamples] = useState(false);

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

      {/* Left side - Simulation or Examples (hidden on mobile) */}
      <div
        className={`hidden lg:flex lg:w-1/2 xl:w-3/5 lg:h-screen lg:sticky lg:top-0 relative overflow-hidden items-center justify-center transition-colors duration-500 ${
          showExamples ? 'bg-pkt-bg-subtle' : 'bg-pkt-brand-dark-blue-1000'
        }`}
      >
        {/* Grid pattern - fades out when showing examples */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${showExamples ? 'opacity-0' : 'opacity-5'}`}
          style={{
            backgroundImage: `
              linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Gradient accents - fade out when showing examples */}
        <div
          className={`absolute top-0 right-0 w-96 h-96 blur-3xl transition-opacity duration-500 ${showExamples ? 'opacity-0' : 'opacity-20'}`}
          style={{ background: 'radial-gradient(circle, var(--color-pkt-brand-blue-1000) 0%, transparent 70%)' }}
        />
        <div
          className={`absolute bottom-0 left-0 w-80 h-80 blur-3xl transition-opacity duration-500 ${showExamples ? 'opacity-0' : 'opacity-15'}`}
          style={{ background: 'radial-gradient(circle, var(--color-pkt-brand-green-1000) 0%, transparent 70%)' }}
        />

        {/* Terminal simulation - visible when not showing examples */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out ${
            showExamples
              ? 'opacity-0 -translate-x-8 pointer-events-none'
              : mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
          }`}
        >
          <div className="w-full max-w-2xl px-12 xl:px-16">
            <div className="bg-black/30 backdrop-blur-sm rounded-lg border border-white/10 p-6">
              <LawLookupSimulation />
            </div>
          </div>
        </div>

        {/* Guide panel - visible when showing guide, scrollable */}
        <div
          className={`absolute inset-0 overflow-y-auto transition-all duration-500 ease-out ${
            showExamples
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 translate-x-8 pointer-events-none'
          }`}
        >
          <GuidePanel onBack={() => setShowExamples(false)} />
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
          <InfoCard onShowGuide={() => setShowExamples(true)} />

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
      <GuideOverlay open={showExamples} onClose={() => setShowExamples(false)} />
    </div>
  );
}

export default LandingPage;
