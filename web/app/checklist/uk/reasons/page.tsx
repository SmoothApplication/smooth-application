import ReasonsView from '@/components/checklist/ReasonsView';

export default function UKReasonsPage() {
  return (
    <ReasonsView
      code="UK"
      flag="🇬🇧"
      name="United Kingdom"
      visaName="Standard Visitor visa"
      answersKey="sa_uk_answers"
      checkedKey="sa_uk_checked"
      backHref="/checklist/uk"
    />
  );
}
