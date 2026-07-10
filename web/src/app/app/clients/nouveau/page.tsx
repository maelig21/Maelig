import NouveauClientForm from "./form"

export const dynamic = "force-dynamic"

export default async function NouveauClientPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  return <NouveauClientForm clientId={id} />
}
