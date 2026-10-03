// Plain-language "what to do / what not to do / how to make it easier" for someone who just ran a bank
// statement through the checker. Built only from numbers the dashboard already computed (see
// finalSummary.ts) - nothing is looked up or sent anywhere. Wording is deliberately simple: short
// sentences, no jargon, no guarantees about visa outcomes.
import type { FinalSummaryInput } from './finalSummary';

export interface ActionPlanInput extends FinalSummaryInput {
  /** More than one income account in play (a second statement uploaded). */
  hasSecondStatement?: boolean;
  /** Employer allowances/bonuses are larger than regular salary (a reviewer will ask about them). */
  largeEmployerAllowances?: boolean;
}

export interface ActionPlan {
  doList: string[];
  dontList: string[];
  easierList: string[];
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export function buildActionPlan(i: ActionPlanInput): ActionPlan {
  const doList: string[] = [];
  const easierList: string[] = [];

  if (i.statementCurrencyIssues.length > 0) {
    doList.push("Get a fresh statement from your bank that covers the last 6 months, stamped by the bank.");
  }
  if (i.unexplainedGroupCount > 0) {
    doList.push(
      `Write one short line for each large deposit - who sent it and why. ${i.unexplainedGroupCount} still need${
        i.unexplainedGroupCount === 1 ? 's' : ''
      } an answer.`
    );
  }
  if (i.closingBalance < i.recommendedFundsFloor) {
    doList.push(
      `Build your balance towards ${fmt(i.recommendedFundsFloor)} and keep it steady for a few weeks before you apply. It is ${fmt(
        i.closingBalance
      )} now.`
    );
  }
  if (!i.hasSalaryIncome && !i.hasOtherRecurringIncome) {
    doList.push('Add proof of where your money comes from: employment letter, payslips or business records.');
  } else if (i.hasSalaryIncome) {
    doList.push('Make sure your employment letter and payslips show the same salary as the credits on this statement.');
  }
  if (i.largeEmployerAllowances) {
    doList.push('Your allowances are larger than your basic salary, which is normal in Nigeria. Ask your employer for a letter or payslip that lists basic salary and each allowance, so the total matches your statement.');
  }
  if (i.totalOutflow > i.totalInflow) {
    doList.push('Spend less for a while. You spent more than came in, which makes your savings look thin.');
  }
  if (i.passportExpired) {
    doList.push('Renew your passport first. It is expired or runs out before you travel.');
  }
  if (doList.length === 0) {
    doList.push('Your statement looks in good shape. Keep your explanations ready and attach the bank-stamped PDF.');
  }

  const dontList = [
    "Don't pay in a big lump sum just before you apply. It can look like borrowed money.",
    "Don't split one big deposit into many small transfers.",
    "Don't edit, retype or crop the statement. Use the bank's own stamped copy.",
    "Don't guess a reason for a deposit. Give the real one and attach proof if you have it.",
  ];

  easierList.push('Use the downloaded Excel sheet as your cover note. It already lists every sender and your reason for each.');
  easierList.push('Tap "Yes, that\'s right" where we suggest a reason, and only change the ones that are wrong.');
  if (i.unexplainedGroupCount > 0) {
    easierList.push('Answer the "Needs your review" senders first. Those are the ones a reviewer is most likely to ask about.');
  }
  if (!i.hasSecondStatement) {
    easierList.push('If your salary account cannot receive other money, add your second account too. It is totalled for you.');
  }
  easierList.push('Put your passport, bank statements and letters in one folder on your phone so you can attach them in one go.');
  easierList.push('Ask your bank for the statement as a PDF by email. Screenshots are hard to read and may be refused.');

  return { doList, dontList, easierList };
}
