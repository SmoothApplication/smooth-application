import { notFound } from 'next/navigation';
import ReasonsView from '@/components/checklist/ReasonsView';
import { COUNTRY_CHECKLISTS } from '@/lib/checklist/registry';

export function generateStaticParams() {
  return Object.keys(COUNTRY_CHECKLISTS).map((code) => ({ country: code.toLowerCase() }));
}

export default function CountryReasonsPage({ params }: { params: { country: string } }) {
  const data = COUNTRY_CHECKLISTS[params.country.toUpperCase()];
  if (!data) notFound();

  const visaNameByCode: Record<string, string> = {
    CA: 'Visitor visa',
    EU: 'Short-stay visa',
    ZA: 'Visitor visa',
    GH: 'travel readiness',
    KE: 'travel readiness',
    ET: 'Tourist e-Visa',
    MA: 'travel readiness',
  };

  return (
    <ReasonsView
      flag={data.flag}
      name={data.name}
      visaName={visaNameByCode[data.code] ?? 'checklist'}
      catOrder={data.catOrder}
      checklist={data.checklist}
      answersKey={`sa_${data.code.toLowerCase()}_answers`}
      checkedKey={`sa_${data.code.toLowerCase()}_checked`}
      backHref={`/checklist/${params.country}`}
    />
  );
}
