import ReasonsView from '@/components/checklist/ReasonsView';
import { CAT_ORDER_UK, CHECKLIST_UK } from '@/lib/checklist/uk';

export default function UKReasonsPage() {
  return (
    <ReasonsView
      flag="🇬🇧"
      name="United Kingdom"
      visaName="Standard Visitor visa"
      catOrder={CAT_ORDER_UK}
      checklist={CHECKLIST_UK}
      answersKey="sa_uk_answers"
      checkedKey="sa_uk_checked"
      backHref="/checklist/uk"
    />
  );
}
