import type { CaseDetailResponse } from '$lib/types/api';

const MOCK_PARAGRAPHS: Record<string, CaseDetailResponse['paragraphs']> = {
	'2023/456': [
		{ paragraph_number: 35, section: 'bakgrunn', text: 'Saken gjelder klage over innklagedes beslutning om \u00e5 tildele kontrakt til valgte leverand\u00f8r. Klager anf\u00f8rer at valgte leverand\u00f8rs tilbud skulle v\u00e6rt avvist fordi forpliktelseserkl\u00e6ring fra st\u00f8ttende virksomhet ikke forel\u00e5 ved tilbudsfristen.' },
		{ paragraph_number: 36, section: 'bakgrunn', text: 'Klager hadde i sitt tilbud oppgitt Firma X AS som st\u00f8ttende virksomhet for oppfyllelse av kvalifikasjonskravet om relevant erfaring.' },
		{ paragraph_number: 42, section: 'vurdering', text: 'Nemnda finner at kravet til forpliktelseserkl\u00e6ring fra st\u00f8ttende virksomhet m\u00e5 foreligge ved tilbudsfristen. ESPD fra st\u00f8ttende virksomhet er ikke tilstrekkelig til \u00e5 dokumentere at tilbyderen faktisk r\u00e5der over den st\u00f8ttende virksomhetens ressurser.' },
		{ paragraph_number: 43, section: 'vurdering', text: 'Det er en vesentlig forskjell mellom ESPD, som er en egenerkl\u00e6ring om at kravene er oppfylt, og en forpliktelseserkl\u00e6ring, som dokumenterer at den st\u00f8ttende virksomheten faktisk stiller sine ressurser til disposisjon.' },
		{ paragraph_number: 44, section: 'vurdering', text: 'Nemnda viser til EU-domstolens avgj\u00f8relse i C-324/14 Partner Apelski, der det ble fastsl\u00e5tt at oppdragsgiver m\u00e5 forsikre seg om at tilbyderen faktisk disponerer over de ressursene som tilh\u00f8rer andre enheter.' },
	],
	'2022/789': [
		{ paragraph_number: 30, section: 'bakgrunn', text: 'Saken gjelder klage over innklagedes beslutning om \u00e5 avvise klagers tilbud. Klager anf\u00f8rer at avvisningen var urettmessig fordi forpliktelseserkl\u00e6ring ble ettersendt innen oppklaringsfristen.' },
		{ paragraph_number: 38, section: 'vurdering', text: 'Nemnda finner at ettersending av forpliktelseserkl\u00e6ring kan aksepteres dersom tilbudet for \u00f8vrig inneholder tilstrekkelig informasjon til \u00e5 vurdere om kvalifikasjonskravet er oppfylt.' },
		{ paragraph_number: 39, section: 'vurdering', text: 'Det avgj\u00f8rende er om ettersendingen inneb\u00e6rer en forbedring av tilbudet eller kun en klargj\u00f8ring av allerede innleverte opplysninger.' },
	],
};

export function mockCaseDetail(sakNr: string): CaseDetailResponse {
	return {
		sak_nr: sakNr,
		avgjoerelse: 'Ikke brudd på regelverket',
		saken_gjelder: 'Mockdata',
		avsluttet: '2023-01-01',
		innklaget: null,
		klager: null,
		sakstype: null,
		regelverk: null,
		summary: null,
		paragraphs: MOCK_PARAGRAPHS[sakNr] ?? [
			{ paragraph_number: 1, section: 'vurdering', text: `Mockdata for sak ${sakNr} er ikke tilgjengelig.` },
		],
		law_references: [
			{ law_name: 'anskaffelsesforskriften', law_section: '16-10', context: 'jf. anskaffelsesforskriften \u00a7 16-10', regulation_version: 'new' },
		],
		case_references: [],
		eu_references: [],
	};
}
