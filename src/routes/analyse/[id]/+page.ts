export function load({ params }: { params: { id: string } }) {
  return { analysisId: params.id };
}
