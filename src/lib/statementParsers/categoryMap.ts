const RULES: Array<[RegExp, string]> = [
  [/utility.?bill|electricity|wapda|ssgc|kesc|nepra|hesco|1-?link|1bill/i, 'Utility Bills'],
  [/fuel|petrol|diesel|service.?station|cng/i, 'Fuel'],
  [/mobile|internet|teleco|ufone|jazz|zong|telenor|ptcl/i, 'Mobile & Internet'],
  [/medical|hospital|pharma|clinic|doctor|lab|health|dvago|saifee/i, 'Medical'],
  [/restaurant|food.?panda|foodpanda|cafe|namkeen|bakery|pizza|burger|biryani|nihari|chai|nandos|kfc|angeethi|shot karachi|ahbab/i, 'Restaurant & Food'],
  [/grocery|superstore|hyperstar|imtiaz|metro|carrefour|agha|naheed|spar|chase.?up|al.?karim|kravemart|am\.pm/i, 'Grocery'],
  [/transport|uber|careem|taxi|ride|bus|railway/i, 'Transport'],
  [/school|college|university|tuition|academy|education/i, 'Education'],
  [/rent|property/i, 'Rent'],
  [/hosting|domain|software|tech|server|cloud|digital|linkedin|google.?one|google.?play|google.?\*|netflix|claude\.ai|anthropic/i, 'Office Expense'],
  [/shopping|mart|store|mall|fashion|garment|cloth|tailor|bachaa/i, 'Shopping'],
  [/insurance|efu|jubilee|adamjee|silk.?protect/i, 'Other'],
  [/sms.?fee|annual.?fee|bank.?charge|service.?charge|excise|fed\b|sales.?tax|withholding|st.s|catax|advance.?tax|fcy.?tran|foreign.?trans|finance.?charge|late.?payment|instalment|principal.?amount|hip|stwh/i, 'Other'],
  [/payment.?received|reversal|refund|reimbursement/i, 'Reimbursement'],
];

export function detectCategory(description: string): string {
  for (const [re, cat] of RULES) {
    if (re.test(description)) return cat;
  }
  return 'Other';
}
