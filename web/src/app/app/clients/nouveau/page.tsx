import NouveauClientForm from "./form"

export default async function NouveauClientPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  return <NouveauClientForm clientId={id} />
}
