# OdontoFlow

Sistema web de gestão odontológica com React + Vite + Firebase.

## O que já está implementado

- Login e criação de conta com Firebase Authentication
- Criação automática da primeira clínica
- Multi-tenant lógico por `clinics/{clinicId}`
- Regras de acesso por membro e papel
- Dashboard
- Pacientes
- Agenda
- Prontuários e evolução clínica
- Financeiro
- Estoque
- Profissionais
- Relatórios
- Configurações da clínica
- Firestore em tempo real
- Firebase Storage preparado
- Fallback local quando Firebase não está configurado
- Layout responsivo
- Estrutura para auditoria

## Configuração

1. Copie `.env.example` para `.env`.
2. Preencha as credenciais do seu Web App no Firebase Console.
3. Ative Authentication > Email/Password.
4. Crie o Firestore.
5. Publique as regras:
   `firebase deploy --only firestore:rules,storage`
6. Rode:
   `npm install`
   `npm run dev`

## Importante

Este projeto é uma base funcional de produção, mas antes de colocar dados clínicos reais é necessário validar as regras de negócio, segurança, LGPD, backups, retenção, consentimentos, índices do Firestore, monitoramento e fluxo operacional da clínica.

Não coloque chaves privadas ou credenciais de servidor no frontend.
