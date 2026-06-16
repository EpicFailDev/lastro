-- Categorias padrão do sistema (user_id null).
insert into public.categories (user_id, name, icon, color, kind) values
  (null, 'Alimentação', 'utensils',     '#E76F51', 'expense'),
  (null, 'Transporte',  'car',          '#2A9D8F', 'expense'),
  (null, 'Moradia',     'home',         '#264653', 'expense'),
  (null, 'Saúde',       'heart',        '#E63946', 'expense'),
  (null, 'Lazer',       'gamepad',      '#F4A261', 'expense'),
  (null, 'Educação',    'book',         '#457B9D', 'expense'),
  (null, 'Compras',     'shopping-bag', '#A8DADC', 'expense'),
  (null, 'Contas',      'file-text',    '#6D6875', 'expense'),
  (null, 'Renda',       'trending-up',  '#52B788', 'income'),
  (null, 'Outros',      'circle',       '#8D99AE', 'both');
