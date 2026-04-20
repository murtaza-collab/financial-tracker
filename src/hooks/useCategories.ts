import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULT_CATEGORIES = [
  'Grocery', 'Restaurant & Food', 'Fuel', 'Utility Bills',
  'Mobile & Internet', 'Medical', 'Transport', 'Shopping',
  'Education', 'Rent', 'Salary', 'Freelance Income',
  'Business Income', 'Reimbursement', 'Family',
  'Entertainment', 'Travel', 'Office Expense', 'Other',
];

export const useCategories = (userId?: string): string[] => {
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    if (!userId) return;
    const fetchCustom = async () => {
      const { data } = await supabase
        .from('custom_categories').select('name')
        .eq('user_id', userId).order('name');
      if (data && data.length > 0) {
        const customNames = data.map((d: { name: string }) => d.name);
        setCategories([...DEFAULT_CATEGORIES, ...customNames]);
      }
    };
    fetchCustom();
  }, [userId]);

  return categories;
};