'use client';

import { Answers } from '@/lib/checklist/uk';
import { COUNTRIES } from '@/lib/checklist/countries';
import { useEditableChecklistState } from '@/lib/checklist/useEditableChecklistState';
import SessionShell from '@/components/checklist/SessionShell';

// Task #382 ("split qualifying-questions form into Sessions 3 and 4"): the original's real session
// 4 is "Your trip details" (see lib/checklist/sessions.ts's header comment) — the rest of the old
// flat qualifying-questions form (CountryChecklistApp's view==='profile') not already covered by
// ResponsibilitiesSession.tsx (session 3): what the trip itself is for, whether a past refusal or
// translation need applies, and whether the applicant has already started their online application.
const PURPOSE_OPTIONS: { value: Answers['purpose']; label: string }[] = [
  { value: '', label: 'Select…' },
  { value: 'tourism', label: 'Tourism / holiday' },
  { value: 'business', label: 'Business meetings' },
  { value: 'conference', label: 'Conference / event' },
  { value: 'medical', label: 'Medical treatment' },
  { value: 'family', label: 'Visiting family' },
  { value: 'wedding', label: 'Wedding / registrar appointment' },
  { value: 'academic', label: 'Academic visit / research' },
  { value: 'training', label: 'Paid training / course' },
];

export type TripDetailsSessionProps = {
  code: string;
};

export default function TripDetailsSession({ code }: TripDetailsSessionProps) {
  const { answers, setAnswers, loaded } = useEditableChecklistState(code);
  const country = COUNTRIES.find((c) => c.code === code.toUpperCase());
  const name = country?.name ?? code;

  if (!loaded) return null;

  return (
    <SessionShell code={code} name={name} session="trip-details">
      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#12232e]">Your trip details</h2>

        <div className="flex flex-col gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={answers.hasRefusal} onChange={(e) => setAnswers({ ...answers, hasRefusal: e.target.checked })} />
            I&apos;ve had a visa refused before
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={answers.translation} onChange={(e) => setAnswers({ ...answers, translation: e.target.checked })} />
            Some of my documents aren&apos;t in English
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={answers.readyToSubmit} onChange={(e) => setAnswers({ ...answers, readyToSubmit: e.target.checked })} />
            I&apos;ve already started my online application
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#12232e]">Main purpose of your trip</label>
            <select
              value={answers.purpose}
              onChange={(e) => setAnswers({ ...answers, purpose: e.target.value as Answers['purpose'] })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            >
              {PURPOSE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
    </SessionShell>
  );
}
