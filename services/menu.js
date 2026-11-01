const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

export const DISHES = [
  ["sp-1", "Butter Chicken", "specialites", 12.9, "photo-1603894584373-5ac82b2ae398", "Creamy tomato butter chicken, served with basmati rice."],
  ["sp-2", "Chicken Masala", "specialites", 12.9, "photo-1585937421612-70a008356fbe", "Slow-cooked chicken in a spiced masala gravy, served with basmati rice."],
  ["sp-3", "Chicken Tikka Masala", "specialites", 12.9, "photo-1565557623262-b51c2513a641", "Grilled chicken tikka folded into a warm masala sauce, with basmati rice."],
  ["sp-4", "Chicken Balti", "specialites", 12.9, "photo-1574484284002-952d92456975", "Chicken balti in a rich pepper sauce, served with basmati rice."],
  ["sp-5", "Poulet Shahi Korma", "specialites", 13.9, "photo-1545247181-516773cae754", "Mild shahi korma with cream and warm spices, served with basmati rice."],
  ["sp-6", "Dal Tadka", "specialites", 10.9, "photo-1546833999-b9f581a1996d", "Tempered yellow lentils finished with ghee and cumin, served with basmati rice."],
  ["by-1", "Biryani Poulet", "biryanis", 12.9, "photo-1563379091339-03b21ab4a4f8", "Chicken biryani layered with saffron basmati rice and fried onions."],
  ["by-2", "Biryani Végétarien", "biryanis", 10.9, "photo-1589302168068-964664d93dc0", "Vegetable biryani with garden vegetables and fragrant basmati rice."],
  ["na-1", "Naan Poulet", "naans", 8.9, "photo-1610194352361-4c81a6a8967e", "Tandoor naan filled with seasoned chicken."],
  ["na-2", "Naan Chicken Masala", "naans", 9.5, "photo-1599487488170-d11ec9c172f0", "Stuffed naan with chicken masala and fresh herbs."],
  ["na-3", "Cheese Naan", "naans", 3.5, "photo-1601050690597-df0568f70950", "Soft tandoor naan stuffed with melted cheese."],
  ["pz-1", "Pizza Chicken", "pizzas", 10, "photo-1565299624946-b28f40a0ae38", "Chicken pizza with house-made sauce."],
  ["pz-2", "Pizza Butter Chicken", "pizzas", 10, "photo-1513104890138-7c749659a591", "Butter chicken pizza with house-made sauce."],
  ["en-1", "Samosa (2 pièces)", "entrees", 3.9, "photo-1606491956689-2ea866880c84", "Two crisp pastry samosas with a spiced filling."],
  ["en-2", "Pakora Légumes (4 pièces)", "entrees", 4.5, "photo-1626132647523-66f5bf380027", "Four vegetable pakoras, fried until golden."],
  ["fo-1", "Menu Butter Chicken", "formules", 14.5, "photo-1505253758473-96b7015fcd40", "Poulet + riz + boisson 33 cl."],
  ["fo-2", "Menu Pizza", "formules", 12, "photo-1574071318508-1cdbab80d002", "Pizza au choix + boisson 33 cl."],
  ["fo-3", "Menu Naan", "formules", 12.5, "photo-1631452180519-c014fe946bc7", "Naan garni + boisson 33 cl."],
  ["bo-1", "Lassi Mangue", "boissons", 3.9, "photo-1623065422902-30a2d299bbe4", "Chilled mango lassi, blended thick and smooth."],
  ["bo-2", "Lassi Rose", "boissons", 3.9, "photo-1556679343-c7306c1976bc", "Rose lassi with a light floral finish."],
  ["bo-3", "Lassi Nature", "boissons", 3.5, "photo-1563636619-e9143da7973b", "Plain yogurt lassi, lightly salted and refreshing."],
  ["bo-4", "Boisson 33 cl", "boissons", 2, "photo-1554866585-cd94860890b7", "Chilled soft drink, 33 cl."],
].map(([code, name, category, price, photo, description]) => ({
  code,
  name,
  category,
  price,
  image: img(photo),
  description,
  isCombo: category === "formules",
}));

export const EXTRA_SEED = [
  { code: "ex-boisson", name: "Boisson 33 cl", priceCents: 200, categories: ["specialites", "biryanis", "naans", "pizzas", "entrees"] },
  { code: "ex-fromage", name: "Supplément fromage", priceCents: 100, categories: ["naans", "pizzas"] },
  { code: "ex-sauce", name: "Sauce", priceCents: 50, categories: ["entrees", "naans", "pizzas"] },
];

export const COMPLEMENTS = [
  ["specialites", "naans"],
  ["specialites", "boissons"],
  ["specialites", "entrees"],
  ["biryanis", "naans"],
  ["biryanis", "boissons"],
  ["naans", "boissons"],
  ["naans", "entrees"],
  ["pizzas", "boissons"],
  ["pizzas", "entrees"],
  ["entrees", "boissons"],
  ["formules", "entrees"],
  ["boissons", "entrees"],
].map(([category, complement]) => ({ category, complement }));

export const CATEGORIES = new Set(["specialites", "biryanis", "naans", "pizzas", "entrees", "formules", "boissons"]);
