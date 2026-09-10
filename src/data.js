export const seed = {
  patients: [
    { name: "Ana Beatriz Silva", phone: "(11) 99999-1001", email: "ana@email.com", birth: "1994-04-12", status: "Ativo" },
    { name: "Carlos Eduardo Santos", phone: "(11) 98888-2002", email: "carlos@email.com", birth: "1988-09-21", status: "Ativo" },
    { name: "Mariana Oliveira", phone: "(11) 97777-3003", email: "mariana@email.com", birth: "2001-02-15", status: "Ativo" }
  ],
  appointments: [],
  finances: [
    { patient: "Ana Beatriz Silva", description: "Plano de tratamento", value: 850, status: "Pago", date: "" },
    { patient: "Carlos Eduardo Santos", description: "Limpeza", value: 180, status: "Pendente", date: "" },
    { patient: "Mariana Oliveira", description: "Restauração", value: 320, status: "Pendente", date: "" }
  ],
  stock: [
    { name: "Luva descartável", category: "EPIs", unit: "cx", quantity: 250, min: 100, cost: 0.35, supplier: "Dental Supply", location: "Armário A", expiry: "2027-08-30" },
    { name: "Máscara cirúrgica", category: "EPIs", unit: "cx", quantity: 180, min: 80, cost: 0.18, supplier: "Dental Supply", location: "Armário A", expiry: "2028-01-15" },
    { name: "Resina composta", category: "Consumíveis", unit: "un", quantity: 12, min: 20, cost: 28.90, supplier: "DentMix", location: "Armário B", expiry: "2027-04-20" }
  ],
  professionals: [
    { name: "Dr. João", specialty: "Cirurgião-dentista", status: "Ativo" },
    { name: "Dra. Camila", specialty: "Ortodontista", status: "Ativo" },
    { name: "Dra. Mariana", specialty: "Implantodontista", status: "Ativo" }
  ],
  records: [],
  treatments: ["Avaliação", "Limpeza", "Restauração", "Clareamento", "Canal", "Implante", "Extração"]
};

export const today = () => new Date().toISOString().slice(0, 10);
export const money = (v = 0) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
