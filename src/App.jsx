import React,{useEffect,useMemo,useState} from "react";
import {LayoutDashboard,Users,CalendarDays,FileText,DollarSign,Package,UserCog,BarChart3,Settings,Search,Plus,Trash2,CheckCircle,Clock,Stethoscope,Menu,LogOut,RefreshCw,ShieldCheck,ArrowDownToLine,ArrowUpFromLine,AlertTriangle,Pencil,Boxes,Paperclip,UserRound,HeartPulse,Image as ImageIcon,FileCheck,Download,Eye,ClipboardList,EyeOff,ChevronLeft,ChevronRight,UserPlus,X,MessageCircle,ZoomIn,ZoomOut,ExternalLink} from "lucide-react";
import { observeAuth, login, register, resetPassword, logout } from "./auth";
import { firebaseEnabled, storage, db } from "./firebase";
import { collectionGroup, getDocs, query, where } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { bootstrapClinic, getClinic, saveClinic, subscribeCollection, addItem, updateItem, removeItem, addClinicMember, getClinicMembers, updateClinicMember } from "./firestore";
import { createEmployeeAccount } from "./auth";
import { enqueueAppointmentConfirmation } from "./services/whatsapp";
import {
  isSupabaseConfigured,
  uploadAttachmentFile,
  getSignedAttachmentUrl,
  downloadAttachmentFile,
  deleteAttachmentFile,
  validateAttachmentFile,
  suggestCategoryFromFileName,
  formatFileSize,
  ATTACHMENT_CATEGORIES
} from "./services/supabaseStorage";
import { seed, today, money } from "./data";
import "./styles.css";
// APK download configuration
const APK_DOWNLOAD_URL = "https://github.com/joaovitortomazidb-ship-it/OrvittaClinic/releases/download/v1.0.0/orvittaclinic.apk";
const APK_VERSION = "1.0.0";

function AuthScreen(){
  const [mode,setMode]=useState("login"),[clinic,setClinic]=useState(""),[name,setName]=useState(""),[phone,setPhone]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[showPassword,setShowPassword]=useState(false),[showConfirmPassword,setShowConfirmPassword]=useState(false);
  const submit=async e=>{
    e.preventDefault();setError("");
    if(mode==="register"&&password!==confirmPassword){setError("As senhas não coincidem.");return;}
    if(mode==="register"&&password.length<6){setError("A senha deve ter pelo menos 6 caracteres.");return;}
    setBusy(true);
    try{
      if(mode==="login") await login(email.trim(),password);
      else {
        const credential=await register(email.trim(),password,{name:name.trim()});
        await bootstrapClinic(credential.user,clinic.trim(),{name:name.trim(),phone:phone.trim()});
      }
    }catch(err){
      const messages={"auth/invalid-credential":"E-mail ou senha inválidos.","auth/user-disabled":"Esta conta está desativada.","auth/too-many-requests":"Muitas tentativas. Aguarde e tente novamente.","auth/email-already-in-use":"Este e-mail já possui uma conta.","auth/weak-password":"A senha não atende aos requisitos mínimos."};
      setError(messages[err.code]||"Não foi possível concluir o cadastro. Verifique seus dados e tente novamente.");
    }
    finally{setBusy(false);}
  };
  if(!firebaseEnabled) return <div className="auth"><div className="authCard"><div className="brand big"><Stethoscope/><b>Orvitta <span>Clinic</span></b></div><h1>Configuração necessária</h1><p>Configure as variáveis do Firebase no arquivo <b>.env</b> para acessar o Orvitta Clinic.</p></div></div>;
  return <div className="auth"><form className="authCard" onSubmit={submit}><div className="brand big"><Stethoscope/><b>Orvitta <span>Clinic</span></b></div><h1>{mode==="login"?"Entrar":"Criar clínica"}</h1><p>{mode==="login"?"Acesse sua agenda e sua clínica odontológica.":"Crie sua clínica e acesse o Orvitta Clinic."}</p>
    {mode==="register"&&<><Input label="Nome da clínica" v={clinic} set={setClinic}/><Input label="Nome do responsável" v={name} set={setName}/><Input label="Telefone" v={phone} set={setPhone}/></>}
    <Input label="E-mail" type="email" v={email} set={setEmail}/>
    <label>Senha<div className="passwordField"><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" title={showPassword?"Ocultar senha":"Mostrar senha"} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
    {mode==="register"&&<label>Confirmar senha<div className="passwordField"><input type={showConfirmPassword?"text":"password"} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required/><button type="button" title={showConfirmPassword?"Ocultar senha":"Mostrar senha"} onClick={()=>setShowConfirmPassword(v=>!v)}>{showConfirmPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
    {error&&<div className="error">{error}</div>}
    <button className="primary full" disabled={busy||!email.trim()||!password||(mode==="register"&&(!clinic.trim()||!name.trim()||!confirmPassword))}>{busy?(mode==="login"?"Entrando...":"Criando clínica..."):mode==="login"?"Entrar":"Criar clínica"}</button>
    {mode==="login"&&<button type="button" className="link" onClick={async()=>{if(email.trim()) await resetPassword(email.trim());}}>Esqueci minha senha</button>}
    <button type="button" className="link" onClick={()=>{setMode(mode==="login"?"register":"login");setError("")}}>{mode==="login"?"Não tenho uma clínica? Criar clínica":"Já tenho uma conta? Entrar"}</button>
  </form></div>
}

const clinicalAlertOptions=[
 {key:"diabetes",label:"Diabetes"},{key:"hypertension",label:"Hipertensão"},{key:"heartDisease",label:"Doença cardíaca"},
 {key:"medicationAllergy",label:"Alergia a medicamento",important:true},{key:"anestheticAllergy",label:"Alergia a anestésico",important:true},
 {key:"anticoagulant",label:"Uso de anticoagulante",important:true},{key:"antiplatelet",label:"Uso de antiagregante",important:true},
 {key:"coagulation",label:"Alteração de coagulação",important:true},{key:"immunosuppression",label:"Imunossupressão",important:true},
 {key:"pregnancy",label:"Gestante"},{key:"kidneyDisease",label:"Doença renal"},{key:"liverDisease",label:"Doença hepática"},
 {key:"respiratoryDisease",label:"Doença respiratória"},{key:"bruxism",label:"Bruxismo"},{key:"specialAttention",label:"Necessidade de atenção especial"},{key:"other",label:"Outro"}
];
const anamnesisDefaults={bloodType:"",allergies:"",medications:"",conditions:"",surgeries:"",pregnancy:"",smoking:"",alcohol:"",bruxism:"",hygiene:"",lastDentist:"",previousTreatments:"",familyHistory:"",notes:"",anamnesisType:"",alerts:[],alertDetails:{},child:{},young:{},adult:{},elderly:{}};
function patientAge(birth){if(!birth)return null;const date=new Date(`${birth}T12:00:00`);if(Number.isNaN(date.getTime()))return null;const now=new Date();let age=now.getFullYear()-date.getFullYear();if(now.getMonth()<date.getMonth()||(now.getMonth()===date.getMonth()&&now.getDate()<date.getDate()))age--;return age>=0?age:null}
function suggestedAnamnesisType(birth){const age=patientAge(birth);if(age===null)return "adult";if(age<=12)return "child";if(age<=17)return "young";if(age>=60)return "elderly";return "adult"}
function getAnamnesis(data,patientId){return data.records.find(record=>record.kind==="anamnesis"&&String(record.patientId)===String(patientId))?.data||anamnesisDefaults}
function patientAlerts(data,patientId){const anam=getAnamnesis(data,patientId);return Array.isArray(anam.alerts)?anam.alerts:[]}
function alertLabels(alerts){return clinicalAlertOptions.filter(item=>alerts.includes(item.key)).map(item=>item.label)}
function hasImportantAlert(alerts){return clinicalAlertOptions.some(item=>item.important&&alerts.includes(item.key))}
function normalizeWhatsappPhone(phone){const digits=String(phone||"").replace(/\D/g,"");if(!digits)return "";return digits.startsWith("55")?digits:`55${digits}`}
function appointmentWhatsappLink(patient,appointment){const phone=normalizeWhatsappPhone(patient?.phone||patient?.whatsapp);if(!phone)return "";const date=appointment?.date?new Date(`${appointment.date}T12:00:00`).toLocaleDateString("pt-BR"):"";const time=appointment?.startTime||appointment?.time||"";const greeting=patient?.name?`Olá, ${patient.name}! Tudo bem?`:`Olá! Tudo bem?`;const when=`Posso confirmar sua consulta para o dia ${date}${time?` às ${time}`:""}?`;return `https://wa.me/${phone}?text=${encodeURIComponent(`${greeting}\n${when}`)}`}


async function resolveClinicAccess(user){
  if(!firebaseEnabled||!db) return {clinicId:user.uid,role:"owner",member:null,clinic:null};

  // O owner conhece sua clínica pelo próprio UID e não precisa depender do
  // índice de collection group usado para localizar funcionários.
  const ownedClinic=await getClinic(user.uid);
  if(ownedClinic){
    return {clinicId:user.uid,role:"owner",member:null,clinic:ownedClinic};
  }

  // Primeiro procura o vínculo do usuário em qualquer clínica.
  // O documento members/{uid} fica dentro de clinics/{clinicId}/members.
  const membershipQuery=query(
    collectionGroup(db,"members"),
    where("uid","==",user.uid)
  );
  const membershipSnap=await getDocs(membershipQuery);

  if(!membershipSnap.empty){
    const memberDoc=membershipSnap.docs[0];
    const clinicId=memberDoc.ref.parent.parent?.id;
    if(!clinicId) throw new Error("Não foi possível identificar a clínica do usuário.");
    const member={id:memberDoc.id,...memberDoc.data()};
    if(member.status&&member.status!=="Ativo"){
      throw new Error("Seu acesso está bloqueado. Entre em contato com o administrador da clínica.");
    }
    const clinic=await getClinic(clinicId);
    if(!clinic) throw new Error("A clínica vinculada a este usuário não foi encontrada.");
    // A clínica cujo ID é o UID do usuário continua sendo a clínica do
    // proprietário, mesmo que o documento antigo de membro esteja como
    // "admin". Funcionários mantêm a role gravada no vínculo.
    const resolvedRole=clinicId===user.uid||(clinic.ownerUid||clinic.ownerId)===user.uid
      ? "owner"
      : member.role||"secretary";
    return {clinicId,role:resolvedRole,member,clinic};
  }

  throw new Error("Este usuário ainda não está vinculado a nenhuma clínica.");
}

function App(){
 const emptyData={patients:[],appointments:[],finances:[],stock:[],professionals:[],records:[]};
 const [user,setUser]=useState(undefined),[clinic,setClinic]=useState(null),[clinicId,setClinicId]=useState(null),[role,setRole]=useState(null),[member,setMember]=useState(null),[data,setData]=useState(firebaseEnabled?emptyData:seed),[page,setPage]=useState("Agenda"),[search,setSearch]=useState(""),[mobile,setMobile]=useState(false),[error,setError]=useState(""),[accessLoading,setAccessLoading]=useState(false),[selectedPatientId,setSelectedPatientId]=useState(null);
 useEffect(()=>observeAuth(setUser),[]);

 useEffect(()=>{
   let cancelled=false;
   const loadAccess=async()=>{
     if(!user||!firebaseEnabled){setAccessLoading(false);return;}
     setAccessLoading(true);
     setClinicId(null);
     setClinic(null);
     setRole(null);
     setMember(null);
     try{
       setError("");
       const access=await resolveClinicAccess(user);
       if(cancelled)return;
       setClinicId(access.clinicId);
       setRole(access.role);
       setMember(access.member);
       setClinic(access.clinic);
     }catch(e){
       if(cancelled)return;
       setClinic(null);
       setClinicId(null);
       setRole(null);
       setMember(null);
       const message=e.code==="permission-denied"
         ? "Permissão negada ao consultar o vínculo da clínica. Verifique as regras do Firebase."
         : e.code==="failed-precondition"||/index/i.test(e.message||"")
           ? "O índice de identificação de funcionários ainda está sendo preparado no Firebase. Tente novamente em alguns instantes."
           : e.message||"Não foi possível identificar a clínica.";
       setError(message);
     }finally{
       if(!cancelled)setAccessLoading(false);
     }
   };
   loadAccess();
   return ()=>{cancelled=true};
 },[user]);

 useEffect(()=>{
   if(!user||!firebaseEnabled||!clinicId)return;
   const permissions=member?.permissions||[];
   const fullAccess=role==="owner"||role==="admin";
   const modules={patients:"Pacientes",appointments:"Agenda",finances:"Financeiro",stock:"Estoque",professionals:"Profissionais",records:"Prontuários"};
   const collections=["patients","appointments","finances","stock","professionals","records"].filter(name=>fullAccess||permissions.includes(modules[name])||permissions.some(item=>item.startsWith(`${name}.`)));
   const unsubs=collections.map(c=>subscribeCollection(clinicId,c,items=>setData(d=>({...d,[c]:items})),e=>setError(e.message)));
   return ()=>unsubs.forEach(u=>u&&u());
 },[user,clinicId]);

 useEffect(()=>{
   if(!firebaseEnabled){
     const x=localStorage.getItem("odontoflow_data");
     if(x)setData(JSON.parse(x));
   }
 },[]);
 useEffect(()=>{if(!firebaseEnabled)localStorage.setItem("odontoflow_data",JSON.stringify(data));},[data]);

 if(user===undefined) return <div className="loading"><RefreshCw className="spin"/> Carregando...</div>;
 if(!user) return <AuthScreen/>;
 if(firebaseEnabled&&!clinicId&&accessLoading) return <div className="loading"><RefreshCw className="spin"/> Identificando sua clínica...</div>;
 if(firebaseEnabled&&!clinicId&&error) return <div className="loading"><div className="error">{error}</div><button className="primary" onClick={logout}>Sair</button></div>;
 if(firebaseEnabled&&!clinicId) return <div className="loading"><RefreshCw className="spin"/> Preparando acesso...</div>;

 const allNav=[["Dashboard",LayoutDashboard],["Pacientes",Users],["Agenda",CalendarDays],["Prontuários",FileText],["Financeiro",DollarSign],["Estoque",Package],["Profissionais",UserCog],["Relatórios",BarChart3],["Configurações",Settings]];
 const allowedPages=role==="owner"||role==="admin"?allNav.map(item=>item[0]):member?.permissions?.length?allNav.filter(([name])=>name==="Agenda"||name==="Dashboard"||member.permissions.includes(name)||member.permissions.some(item=>({Pacientes:"patients",Agenda:"appointments",Financeiro:"finances",Estoque:"stock",Profissionais:"professionals",Prontuários:"records",Relatórios:"reports",Configurações:"settings"}[name]||"")+"."===item.slice(0,item.indexOf(".")+1))).filter(([name])=>name!=="Configurações").map(item=>item[0]):["Agenda","Dashboard"];
 const nav=allNav.filter(([name])=>allowedPages.includes(name));
 const can=(module,action)=>role==="owner"||role==="admin"||member?.permissions?.includes(module)||member?.permissions?.includes(action);
 const write=async(collectionName,payload)=>{
   if(firebaseEnabled){
    const id=await addItem(clinicId,collectionName,payload);
    if(collectionName==="appointments"&&payload.phone&&payload.whatsappStatus!=="failed"){
      enqueueAppointmentConfirmation(clinicId,{...payload,id}).catch(()=>{});
    }
    return id;
   }
   const id=Date.now()+Math.random();
   setData(d=>({...d,[collectionName]:[...d[collectionName],{...payload,id}]}));
   return id;
 };
 const update=async(collectionName,id,payload)=>{
   if(firebaseEnabled) await updateItem(clinicId,collectionName,id,payload);
   else setData(d=>({...d,[collectionName]:d[collectionName].map(x=>x.id===id?{...x,...payload}:x)}));
 };
 const remove=async(collectionName,id)=>{
   if(firebaseEnabled) await removeItem(clinicId,collectionName,id);
   else setData(d=>({...d,[collectionName]:d[collectionName].filter(x=>x.id!==id)}));
 };
 const content={
  Dashboard:<Dashboard data={data}/>,
  Pacientes:<Patients data={data} search={search} write={write} remove={remove} can={can} onOpenRecord={id=>{setSelectedPatientId(id);setPage("Prontuários")}}/>,
  Agenda:<Agenda data={data} write={write} update={update} remove={remove} can={can} onOpenRecord={id=>{setSelectedPatientId(id);setPage("Prontuários")}}/>,
  Prontuários:<Records data={data} write={write} update={update} remove={remove} userId={clinicId} uid={user.uid} initialPatientId={selectedPatientId} can={can}/>,
  Financeiro:<Finance data={data} update={update} write={write} can={can}/>,
  Estoque:<Stock data={data} update={update} write={write} remove={remove} can={can}/>,
  Profissionais:<ProfessionalManager data={data} write={write} clinicId={clinicId} role={role}/>,
  Relatórios:<Reports data={data}/>,
  Configurações:<SettingsPage clinic={clinic} save={async x=>{if(firebaseEnabled)await saveClinic(clinicId,x);setClinic(c=>({...c,...x}))}}/>
 }[page];

 return <div className="app">
  <aside className={"sidebar "+(mobile?"show":"")}><div className="brand"><Stethoscope/><b>Orvitta <span>Clinic</span></b></div>
   {nav.map(([n,I])=><button className={page===n?"nav active":"nav"} onClick={()=>{setPage(n);setMobile(false)}} key={n}><I size={19}/>{n}</button>)}
   <div className="clinic"><div className="avatar">OF</div><div><b>{clinic?.name||"Minha Clínica"}</b><small>{user.email}</small><small>{role==="owner"?"Administrador":"Funcionário"}</small></div></div>
   <button className="nav logout" onClick={logout}><LogOut size={19}/>Sair</button>
  </aside>
  <main><header><button className="mobileBtn" onClick={()=>setMobile(!mobile)}><Menu/></button><div className="search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar pacientes, consultas..."/></div><div className="headerUser"><div className="avatar">{(user.email||"OF").slice(0,2).toUpperCase()}</div><span>{role==="owner"?"Administrador":member?.name||"Funcionário"}</span></div></header>
   {error&&<div className="globalError">{error}</div>}
   <div className="page"><div className="pageTitle"><div><h1>{page}</h1><p>{page==="Dashboard"?"Visão geral da sua clínica":`Gerencie ${page.toLowerCase()} da clínica`}</p></div>{["Pacientes","Agenda","Financeiro","Estoque","Profissionais"].includes(page)&&<button className="primary" onClick={()=>window.dispatchEvent(new Event("newItem"))}><Plus size={18}/> Novo</button>}</div>{content}</div>
  </main>
 </div>
}

function Dashboard({data}){
 const revenue=data.finances.filter(x=>x.status==="Pago").reduce((a,b)=>a+Number(b.value||0),0),pending=data.finances.filter(x=>x.status!=="Pago").reduce((a,b)=>a+Number(b.value||0),0);
 const apps=data.appointments.filter(x=>x.date===today());
 return <><div className="cards"><Card icon={Users} title="Pacientes" value={data.patients.length} note="Base cadastrada"/><Card icon={CalendarDays} title="Consultas hoje" value={apps.length} note="Agenda do dia"/><Card icon={DollarSign} title="Receita recebida" value={money(revenue)} note="Pagamentos registrados"/><Card icon={Clock} title="A receber" value={money(pending)} note="Contas pendentes"/></div>
 <div className="grid2"><section className="panel"><h3>Agenda de hoje</h3>{apps.length?apps.map(a=><div className="row" key={a.id}><div className="time">{a.time}</div><div className="rowmain"><b>{a.patient}</b><small>{a.type} • {a.professional}</small></div><span className={"badge "+String(a.status||"").toLowerCase()}>{a.status}</span></div>):<Empty text="Nenhuma consulta hoje."/>}</section>
 <section className="panel"><h3>Resumo financeiro</h3><div className="financeBig">{money(revenue)}<small>recebido</small></div><div className="bar"><i style={{width:`${Math.min(100,revenue/(revenue+pending||1)*100)}%`}}/></div><div className="legend"><span>Recebido <b>{money(revenue)}</b></span><span>A receber <b>{money(pending)}</b></span></div></section></div>
 <section className="panel"><h3>Operação</h3><div className="quick"><span><ShieldCheck/> Dados protegidos por autenticação e regras do Firebase</span><span><Users/> {data.professionals.length} profissionais</span><span><Package/> {data.stock.length} itens de estoque</span></div></section></>
}
function Card({icon:I,title,value,note}){return <div className="card"><div className="cardIcon"><I size={21}/></div><small>{title}</small><strong>{value}</strong><em>{note}</em></div>}
function Patients({data,search,write,remove,can,onOpenRecord}){
 const [open,setOpen]=useState(false),[form,setForm]=useState({name:"",phone:"",email:"",birth:""});
 useEffect(()=>{const h=()=>setOpen(true);window.addEventListener("newItem",h);return()=>window.removeEventListener("newItem",h)},[]);
 const list=data.patients.filter(p=>(p.name||"").toLowerCase().includes(search.toLowerCase()));
 const canSeeAlerts=can("Prontuários","records.view");
 const add=async()=>{if(!form.name)return;await write("patients",{...form,status:"Ativo"});setForm({name:"",phone:"",email:"",birth:""});setOpen(false)};
 return <section className="panel"><div className="toolbar"><div><h3>Pacientes cadastrados</h3><small>{list.length} pacientes</small></div>{can("Pacientes","patients.create")&&<button className="primary" onClick={()=>setOpen(true)}><Plus size={18}/> Novo paciente</button>}</div>
 <div className="table"><div className="tr th"><span>Paciente</span><span>Contato</span><span>Nascimento</span><span>Status</span><span></span></div>{list.map(p=>{const alerts=canSeeAlerts?patientAlerts(data,p.id):[];return <div className="tr patientRowClickable" key={p.id} onClick={()=>onOpenRecord?.(p.id)} title="Abrir ficha completa"><span><b>{p.name} {alerts.length>0&&<AlertIndicator alerts={alerts} important={hasImportantAlert(alerts)}/>}</b><small>Clique para abrir o prontuário completo</small></span><span>{p.phone||"—"}<small>{p.email||"—"}</small></span><span>{p.birth||"—"}</span><span><span className="badge ativo">Ativo</span></span><span>{can("Pacientes","patients.delete")&&<button className="iconBtn" onClick={e=>{e.stopPropagation();remove("patients",p.id)}}><Trash2 size={16}/></button>}</span></div>})}</div>
 {open&&<Modal title="Novo paciente" close={()=>setOpen(false)}><Input label="Nome completo" v={form.name} set={v=>setForm({...form,name:v})}/><Input label="Telefone" v={form.phone} set={v=>setForm({...form,phone:v})}/><Input label="E-mail" v={form.email} set={v=>setForm({...form,email:v})}/><Input label="Nascimento" type="date" v={form.birth} set={v=>setForm({...form,birth:v})}/><button className="primary full" onClick={add}>Cadastrar paciente</button></Modal>}</section>
}
function AppointmentWhatsappButton({patient,appointment}){const href=appointmentWhatsappLink(patient,appointment);if(!href)return null;return <a className="secondary" href={href} target="_blank" rel="noreferrer" title="Abrir WhatsApp do paciente"><MessageCircle size={15}/> WhatsApp</a>}
function Agenda({data,write,update,remove,can,onOpenRecord}){
 const [view,setView]=useState("day"),[selectedDate,setSelectedDate]=useState(today()),[professional,setProfessional]=useState("Todos"),[confirmationFilter,setConfirmationFilter]=useState("Todos"),[open,setOpen]=useState(false),[details,setDetails]=useState(null),[editing,setEditing]=useState(null);
 const empty={patientId:"",patient:"",professional:"",date:selectedDate,startTime:"08:00",endTime:"09:00",type:"Avaliação",status:"Agendada",notes:""};
 const [form,setForm]=useState(empty);
 useEffect(()=>{const handler=()=>{setEditing(null);setForm({...empty,date:selectedDate});setOpen(true)};window.addEventListener("newItem",handler);return()=>window.removeEventListener("newItem",handler)},[selectedDate]);
 const dateValue=value=>new Date(`${value}T12:00:00`);
 const formatDate=value=>dateValue(value).toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"});
 const shiftDate=(amount)=>{const next=dateValue(selectedDate);next.setDate(next.getDate()+amount);setSelectedDate(next.toISOString().slice(0,10))};
 const startOfWeek=value=>{const date=dateValue(value),day=date.getDay();date.setDate(date.getDate()-(day===0?6:day-1));return date};
 const weekDates=Array.from({length:7},(_,index)=>{const date=startOfWeek(selectedDate);date.setDate(date.getDate()+index);return date.toISOString().slice(0,10)});
 const confirmationState=item=>item.confirmationStatus||((item.status||"")==="Confirmada"?"confirmed":(item.status||"")==="Cancelada"?"cancelled":"pending");
 const visibleAppointments=data.appointments.filter(item=>(professional==="Todos"||item.professional===professional)).filter(item=>confirmationFilter==="Todos"||confirmationState(item)===confirmationFilter);
 const appointmentsFor=value=>visibleAppointments.filter(item=>item.date===value).sort((a,b)=>(a.startTime||a.time||"").localeCompare(b.startTime||b.time||""));
 const professionals=Array.from(new Set(data.professionals.map(item=>item.name).concat(data.appointments.map(item=>item.professional).filter(Boolean))));
 const professionalColor=appointment=>data.professionals.find(item=>item.name===appointment.professional)?.calendarColor||"#2563eb";
 const canSeeAlerts=can("Prontuários","records.view");
 const appointmentPatient=appointment=>data.patients.find(item=>String(item.id)===String(appointment?.patientId));
 const updatePatient=(patientId)=>{const patient=data.patients.find(item=>String(item.id)===String(patientId));setForm(value=>({...value,patientId,patient:patient?.name||""}))};
 const save=async()=>{if(!form.patientId||!form.date||!form.startTime)return;const patient=data.patients.find(item=>String(item.id)===String(form.patientId));const payload={...form,patient:patient?.name||form.patient,phone:patient?.phone||patient?.whatsapp||"",confirmationStatus:form.status==="Confirmada"?"confirmed":form.status==="Cancelada"?"cancelled":"pending",whatsappStatus:form.whatsappStatus||"not_sent",confirmationSource:form.confirmationSource||"staff"};if(editing)await update("appointments",editing.id,payload);else await write("appointments",payload);setOpen(false);setEditing(null)};
 const editAppointment=appointment=>{if(!can("Agenda","appointments.edit"))return;setDetails(null);setEditing(appointment);setForm({...empty,...appointment});setOpen(true)};
 const statusClass=status=>String(status||"Agendada").toLowerCase().replaceAll(" ","-");
 const changeStatus=async(status)=>{if(details){const permission=status==="Confirmada"?"appointments.confirm":status==="Cancelada"?"appointments.cancel":"appointments.edit";if(!can("Agenda",permission))return;const confirmationStatus=status==="Confirmada"?"confirmed":status==="Cancelada"?"cancelled":"pending";await update("appointments",details.id,{status,confirmationStatus,confirmationSource:"staff",confirmationRespondedAt:new Date().toISOString()});setDetails({...details,status,confirmationStatus})}};
 const confirmationLabel=item=>confirmationState(item)==="confirmed"?"Confirmada":confirmationState(item)==="cancelled"?"Cancelada":"Aguardando confirmação";
 const appointmentBlock=appointment=>{const alerts=canSeeAlerts?patientAlerts(data,appointment.patientId):[];return <button className={`agendaAppointment ${statusClass(appointment.status)}`} style={{borderLeftColor:professionalColor(appointment)}} key={appointment.id} onClick={()=>setDetails(appointment)} title={alerts.length?`Alertas clínicos: ${alertLabels(alerts).join(", ")}`:undefined}><strong>{appointment.startTime||appointment.time}</strong><span>{appointment.patient} {alerts.length>0&&<AlertIndicator alerts={alerts} important={hasImportantAlert(alerts)}/>}</span><small>{appointment.type} • {appointment.professional||"Sem profissional"}</small><em className={`confirmationHint ${confirmationState(appointment)}`}>{confirmationLabel(appointment)}</em></button>};
 const dayView=()=> <div className="agendaTimeline">{Array.from({length:13},(_,index)=>{const hour=index+7,time=`${String(hour).padStart(2,"0")}:00`;return <div className="agendaHour" key={time}><span>{time}</span><div>{appointmentsFor(selectedDate).filter(item=>(item.startTime||item.time||"").startsWith(String(hour).padStart(2,"0"))).map(appointmentBlock)}</div></div>})}</div>;
 const weekView=()=> <div className="agendaWeek"><div className="agendaWeekHead"><span>Horário</span>{weekDates.map(value=><button key={value} className={value===selectedDate?"active":""} onClick={()=>setSelectedDate(value)}>{dateValue(value).toLocaleDateString("pt-BR",{weekday:"short"})}<b>{dateValue(value).getDate()}</b></button>)}</div>{Array.from({length:13},(_,index)=>{const hour=index+7;return <div className="agendaWeekRow" key={hour}><span>{String(hour).padStart(2,"0")}:00</span>{weekDates.map(value=><div key={value}>{appointmentsFor(value).filter(item=>(item.startTime||item.time||"").startsWith(String(hour).padStart(2,"0"))).map(appointmentBlock)}</div>)}</div>})}</div>;
 const monthView=()=>{const first=dateValue(selectedDate);first.setDate(1);const offset=first.getDay()===0?6:first.getDay()-1;const days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();return <div className="agendaMonth"><div className="agendaMonthHead">{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(day=><span key={day}>{day}</span>)}</div><div className="agendaMonthGrid">{Array.from({length:offset+days},(_,index)=>{if(index<offset)return <div className="monthEmpty" key={`empty-${index}`}/>;const day=index-offset+1,value=new Date(first.getFullYear(),first.getMonth(),day).toISOString().slice(0,10);return <button className={value===selectedDate?"monthDay active":"monthDay"} key={value} onClick={()=>{setSelectedDate(value);setView("day")}}><b>{day}</b>{appointmentsFor(value).slice(0,3).map(appointmentBlock)}{appointmentsFor(value).length>3&&<small>+{appointmentsFor(value).length-3} consultas</small>}</button>})}</div></div>};
 return <section className="panel agendaPanel"><div className="agendaToolbar"><div><h3>Agenda</h3><small>{formatDate(selectedDate)}</small></div><div className="agendaToolbarActions"><button className="secondary" onClick={()=>setSelectedDate(today())}>Hoje</button><button className="iconBtn" onClick={()=>shiftDate(view==="week"?-7:view==="month"?-30:-1)} title="Anterior"><ChevronLeft size={18}/></button><button className="iconBtn" onClick={()=>shiftDate(view==="week"?7:view==="month"?30:1)} title="Próximo"><ChevronRight size={18}/></button><input type="date" value={selectedDate} onChange={event=>setSelectedDate(event.target.value)}/>{can("Agenda","appointments.create")&&<button className="primary" onClick={()=>{setEditing(null);setForm({...empty,date:selectedDate});setOpen(true)}}><Plus size={17}/> Nova consulta</button>}</div></div><div className="agendaControls"><div className="segmented"><button className={view==="day"?"active":""} onClick={()=>setView("day")}>Dia</button><button className={view==="week"?"active":""} onClick={()=>setView("week")}>Semana</button><button className={view==="month"?"active":""} onClick={()=>setView("month")}>Mês</button></div><label>Profissional<select value={professional} onChange={event=>setProfessional(event.target.value)}><option>Todos</option>{professionals.map(item=><option key={item}>{item}</option>)}</select></label></div>{view==="day"?dayView():view==="week"?weekView():monthView()}
 {open&&<Modal title={editing?"Editar consulta":"Nova consulta"} close={()=>{setOpen(false);setEditing(null)}}><div className="formGrid"><label>Paciente<select value={form.patientId||""} onChange={event=>updatePatient(event.target.value)}><option value="">Selecione</option>{data.patients.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Profissional<select value={form.professional||""} onChange={event=>setForm({...form,professional:event.target.value})}><option value="">Selecione</option>{data.professionals.map(item=><option key={item.id}>{item.name}</option>)}</select></label><Input label="Data" type="date" v={form.date} set={value=>setForm({...form,date:value})}/><Input label="Horário inicial" type="time" v={form.startTime} set={value=>setForm({...form,startTime:value})}/><Input label="Horário final" type="time" v={form.endTime} set={value=>setForm({...form,endTime:value})}/><Input label="Procedimento" v={form.type} set={value=>setForm({...form,type:value})}/><label>Status<select value={form.status} onChange={event=>setForm({...form,status:event.target.value})}>{["Agendada","Confirmada","Em atendimento","Concluída","Cancelada","Faltou"].map(item=><option key={item}>{item}</option>)}</select></label><label>Observações<textarea value={form.notes||""} onChange={event=>setForm({...form,notes:event.target.value})}/></label></div><button className="primary full" onClick={save}>Salvar consulta</button></Modal>}
 {details&&<Modal title="Detalhes da consulta" close={()=>setDetails(null)}><div className="appointmentDetails"><b>{details.patient}</b><span>{details.date} • {details.startTime||details.time} - {details.endTime||""}</span><span>{details.professional||"Sem profissional"} • {details.type}</span><span className={`badge ${statusClass(details.status)}`}>{details.status}</span>{details.notes&&<p>{details.notes}</p>}</div><div className="modalActions"><AppointmentWhatsappButton patient={appointmentPatient(details)} appointment={details}/>{can("Agenda","appointments.edit")&&<button className="secondary" onClick={()=>editAppointment(details)}><Pencil size={15}/> Editar</button>}{can("Agenda","appointments.confirm")&&<button className="secondary" onClick={()=>changeStatus("Confirmada")}>Confirmar</button>}{can("Agenda","appointments.edit")&&<button className="secondary" onClick={()=>changeStatus("Concluída")}>Concluir</button>}{can("Agenda","appointments.cancel")&&<button className="secondary" onClick={()=>changeStatus("Cancelada")}>Cancelar</button>}{can("Agenda","appointments.delete")&&<button className="danger" onClick={async()=>{await remove("appointments",details.id);setDetails(null)}}><Trash2 size={15}/> Excluir</button>}<button className="primary" onClick={()=>{onOpenRecord?.(details.patientId);setDetails(null)}}>Abrir prontuário</button></div></Modal>}
 </section>;
}
function AlertIndicator({alerts,important=false}){return <span className={`clinicalAlertIndicator ${important?"important":""}`} title={`Alertas clínicos: ${alertLabels(alerts).join(", ")}`}><AlertTriangle size={14}/></span>}
function AlertSummary({alerts}){return <div className="clinicalAlertSummary"><b><AlertTriangle size={15}/> Alertas clínicos</b><span>{alertLabels(alerts).join(" • ")}</span></div>}
function AnamnesisField({label,value,onChange,area=false}){return <label>{label}{area?<textarea value={value||""} onChange={e=>onChange(e.target.value)}/>:<input value={value||""} onChange={e=>onChange(e.target.value)}/>}</label>}
function AnamnesisSection({title,children}){return <section className="anamnesisSection"><h4>{title}</h4><div className="formGrid clinicalGrid">{children}</div></section>}
function AnamnesisForm({anam,setAnam,patient,saving,save}){
 const type=anam.anamnesisType||suggestedAnamnesisType(patient?.birth),age=patientAge(patient?.birth),update=(key,value)=>setAnam(current=>({...current,[key]:value})),nested=(group,key,value)=>setAnam(current=>({...current,[group]:{...(current[group]||{}),[key]:value}})),selectedAlerts=Array.isArray(anam.alerts)?anam.alerts:[];
 const text=(key,label,area=false)=><AnamnesisField label={label} value={anam[key]} onChange={value=>update(key,value)} area={area}/>;
 const group=(name,key,label,area=false)=><AnamnesisField label={label} value={anam[name]?.[key]} onChange={value=>nested(name,key,value)} area={area}/>;
 const toggleAlert=key=>update("alerts",selectedAlerts.includes(key)?selectedAlerts.filter(item=>item!==key):[...selectedAlerts,key]);
 return <div className="anamnesisPanel"><div className="sectionTitle"><div><h4>Anamnese do paciente</h4><small>{age===null?"Idade não informada":`${age} anos`} • sugestão automática, com ajuste manual</small></div><button className="primary" onClick={save} disabled={saving}><CheckCircle size={17}/> {saving?"Salvando...":"Salvar anamnese"}</button></div><div className="formGrid clinicalGrid"><label>Tipo de anamnese<select value={type} onChange={e=>update("anamnesisType",e.target.value)}><option value="child">Infantil (0 a 12 anos)</option><option value="young">Jovem (13 a 17 anos)</option><option value="adult">Adulto (18 a 59 anos)</option><option value="elderly">Idoso (60 anos ou mais)</option></select></label>{text("bloodType","Tipo sanguíneo")}{text("allergies","Alergias")}{text("medications","Medicamentos em uso")}{text("conditions","Doenças / condições relevantes")}{text("surgeries","Cirurgias / internações anteriores")}</div>
 <AnamnesisSection title="ALERTAS CLÍNICOS"><div className="alertPicker">{clinicalAlertOptions.map(item=><label key={item.key}><input type="checkbox" checked={selectedAlerts.includes(item.key)} onChange={()=>toggleAlert(item.key)}/>{item.label}</label>)}</div>{selectedAlerts.includes("medicationAllergy")&&<><AnamnesisField label="Qual medicamento causa alergia?" value={anam.alertDetails?.medicationAllergy?.medicine} onChange={value=>nested("alertDetails","medicationAllergy",{...(anam.alertDetails?.medicationAllergy||{}),medicine:value})}/><AnamnesisField label="Qual reação?" value={anam.alertDetails?.medicationAllergy?.reaction} onChange={value=>nested("alertDetails","medicationAllergy",{...(anam.alertDetails?.medicationAllergy||{}),reaction:value})}/></>}{selectedAlerts.includes("anestheticAllergy")&&<AnamnesisField label="Anestésico / reação" value={anam.alertDetails?.anestheticAllergy} onChange={value=>nested("alertDetails","anestheticAllergy",value)}/>} {selectedAlerts.includes("anticoagulant")&&<><AnamnesisField label="Anticoagulante, dosagem e observações" value={anam.alertDetails?.anticoagulant} onChange={value=>nested("alertDetails","anticoagulant",value)}/></>}{selectedAlerts.includes("antiplatelet")&&<AnamnesisField label="Antiagregante, dosagem e observações" value={anam.alertDetails?.antiplatelet} onChange={value=>nested("alertDetails","antiplatelet",value)}/>} {selectedAlerts.includes("diabetes")&&<AnamnesisField label="Diabetes: tipo, controle e observações" value={anam.alertDetails?.diabetes} onChange={value=>nested("alertDetails","diabetes",value)}/>} {selectedAlerts.includes("other")&&<AnamnesisField label="Outro alerta" value={anam.alertDetails?.other} onChange={value=>nested("alertDetails","other",value)}/>}</AnamnesisSection>
 {type==="child"&&<><AnamnesisSection title="DADOS E DESENVOLVIMENTO">{group("child","responsible","Responsável")}{group("child","relation","Relação com o paciente")}{group("child","gestationalHistory","Histórico gestacional",true)}{group("child","pregnancyConditions","Condições durante a gestação",true)}{group("child","deliveryType","Tipo de parto")}{group("child","premature","Nascimento prematuro")}{group("child","birthWeight","Peso ao nascer")}{group("child","development","Desenvolvimento",true)}{group("child","healthConditions","Condições de saúde relevantes",true)}</AnamnesisSection><AnamnesisSection title="HISTÓRICO MÉDICO">{group("child","diseases","Doenças",true)}{group("child","hospitalizations","Internações",true)}{group("child","surgeries","Cirurgias",true)}{group("child","medications","Medicamentos",true)}{group("child","allergies","Alergias",true)}{group("child","familyHistory","Histórico familiar",true)}</AnamnesisSection><AnamnesisSection title="HÁBITOS, ALIMENTAÇÃO E HIGIENE">{group("child","habits","Sucção de dedo, chupeta, mamadeira, roer unhas, respiração bucal e bruxismo",true)}{group("child","sugarFrequency","Frequência de consumo de açúcar")}{group("child","sugaryDrinks","Bebidas açucaradas")}{group("child","nightFeeding","Alimentação noturna")}{group("child","brushingFrequency","Frequência de escovação")}{group("child","toothpaste","Uso de creme dental")}{group("child","floss","Uso de fio dental")}{group("child","supervision","Supervisão dos responsáveis")}</AnamnesisSection><AnamnesisSection title="HISTÓRICO ODONTOLÓGICO">{group("child","firstVisit","Primeira consulta odontológica")}{group("child","experiences","Experiências anteriores",true)}{group("child","treatments","Tratamentos anteriores",true)}{group("child","trauma","Trauma dentário",true)}{group("child","orthodontics","Uso de aparelho")}{group("child","other","Outras informações",true)}</AnamnesisSection></>}
 {type==="young"&&<><AnamnesisSection title="SAÚDE GERAL">{group("young","diseases","Doenças",true)}{group("young","surgeries","Cirurgias e internações",true)}{group("young","medications","Medicamentos",true)}{group("young","allergies","Alergias",true)}{group("young","medicalFollowup","Acompanhamento médico",true)}{group("young","familyHistory","Histórico familiar",true)}</AnamnesisSection><AnamnesisSection title="HÁBITOS E ROTINA">{group("young","diet","Alimentação",true)}{group("young","sugar","Consumo de açúcar")}{group("young","hygiene","Higiene bucal e fio dental",true)}{group("young","bruxism","Bruxismo e hábitos parafuncionais",true)}{group("young","smoking","Tabagismo")}{group("young","alcohol","Consumo de álcool")}{group("young","other","Outras observações",true)}</AnamnesisSection><AnamnesisSection title="SAÚDE BUCAL">{group("young","history","Histórico odontológico",true)}{group("young","treatments","Tratamentos anteriores",true)}{group("young","orthodontics","Aparelho ortodôntico")}{group("young","pain","Dores e sensibilidade",true)}{group("young","bleeding","Sangramento gengival")}{group("young","otherOral","Outras informações",true)}</AnamnesisSection></>}
 {type==="adult"&&<><AnamnesisSection title="SAÚDE GERAL">{text("pregnancy","Gestação / possibilidade de gestação")}{text("familyHistory","Histórico familiar",true)}{text("conditions","Doenças atuais e anteriores",true)}{text("surgeries","Cirurgias e internações",true)}{text("medications","Medicamentos de uso contínuo",true)}{text("allergies","Alergias",true)}{text("medicalFollowup","Acompanhamento médico",true)}</AnamnesisSection><AnamnesisSection title="CONDIÇÕES IMPORTANTES">{group("adult","diabetes","Diabetes")}{group("adult","hypertension","Hipertensão")}{group("adult","heartDisease","Doenças cardíacas")}{group("adult","respiratory","Doenças respiratórias")}{group("adult","kidney","Doenças renais")}{group("adult","liver","Doenças hepáticas")}{group("adult","coagulation","Alterações de coagulação")}{group("adult","immunosuppression","Imunossupressão")}{group("adult","other","Outras condições",true)}</AnamnesisSection><AnamnesisSection title="MEDICAMENTOS E HÁBITOS">{group("adult","medicationList","Medicamento, dosagem, frequência e observações",true)}{text("smoking","Tabagismo")}{text("alcohol","Álcool")}{text("bruxism","Bruxismo")}{text("hygiene","Alimentação, açúcar e higiene bucal",true)}</AnamnesisSection><AnamnesisSection title="HISTÓRICO ODONTOLÓGICO">{text("previousTreatments","Tratamentos, extrações, implantes, próteses e ortodontia",true)}{group("adult","specialties","Endodontia e periodontia",true)}{group("adult","symptoms","Dores, sensibilidade e sangramento",true)}{group("adult","otherOral","Outras observações",true)}</AnamnesisSection></>}
 {type==="elderly"&&<><AnamnesisSection title="SAÚDE GERAL">{group("elderly","chronicDiseases","Doenças crônicas",true)}{group("elderly","surgeries","Cirurgias e internações",true)}{group("elderly","medicalFollowup","Acompanhamento médico",true)}{group("elderly","allergies","Alergias",true)}{group("elderly","familyHistory","Histórico familiar",true)}</AnamnesisSection><AnamnesisSection title="MEDICAMENTOS E CONDIÇÕES IMPORTANTES">{group("elderly","medications","Medicamentos, dosagem, frequência e observações",true)}{group("elderly","diabetes","Diabetes")}{group("elderly","hypertension","Hipertensão")}{group("elderly","heartDisease","Doenças cardíacas")}{group("elderly","coagulation","Alterações de coagulação")}{group("elderly","anticoagulants","Anticoagulantes / antiagregantes",true)}{group("elderly","kidney","Doenças renais")}{group("elderly","liver","Doenças hepáticas")}{group("elderly","immunosuppression","Imunossupressão")}{group("elderly","limitations","Limitações funcionais",true)}</AnamnesisSection><AnamnesisSection title="SAÚDE BUCAL E ROTINA">{group("elderly","prostheses","Próteses e implantes",true)}{group("elderly","hygieneDifficulty","Dificuldade de higiene")}{group("elderly","xerostomia","Xerostomia")}{group("elderly","pain","Dor e sensibilidade",true)}{group("elderly","bleeding","Sangramento")}{group("elderly","chewing","Dificuldade de mastigação")}{group("elderly","swallowing","Dificuldade de deglutição")}{group("elderly","caregiver","Responsável / cuidador")}{group("elderly","assistance","Necessidade de auxílio")}{group("elderly","frequency","Frequência de higiene")}{group("elderly","other","Observações importantes",true)}</AnamnesisSection></>}
 <div className="formGrid clinicalGrid">{text("bruxism","Bruxismo / apertamento")}{text("hygiene","Higiene bucal / hábitos",true)}{text("lastDentist","Última consulta odontológica")}{text("previousTreatments","Tratamentos odontológicos anteriores",true)}{text("notes","Observações importantes",true)}</div></div>;
}

function Records({data,write,update,remove,userId,uid,initialPatientId,can}){
 const [patient,setPatient]=useState(()=>data.patients.find(p=>p.id===initialPatientId)||null),[tab,setTab]=useState("overview"),[note,setNote]=useState(""),[complaint,setComplaint]=useState(""),[diagnosis,setDiagnosis]=useState(""),[toothStates, setToothStates] = useState({});
  const [infantToothStates, setInfantToothStates] = useState({});
  // odontogramMode removed – mixed dentition always active
  const permanentUpper = [11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28];
  const permanentLower = [31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48];
  const infantUpperRight = [55,54,53,52,51];
  const infantUpperLeft = [61,62,63,64,65];
  const infantLowerLeft = [71,72,73,74,75];
  const infantLowerRight = [81,82,83,84,85];
const [saving,setSaving]=useState(false),[attach,setAttach]=useState({category:"Outros",name:"",description:""});
 const [anam,setAnam]=useState(anamnesisDefaults);
 const [editPatient,setEditPatient]=useState(false),[patientForm,setPatientForm]=useState({}),[attachmentStatus,setAttachmentStatus]=useState(""),[localAttachments,setLocalAttachments]=useState([]);
 const [selectedFile,setSelectedFile]=useState(null),[selectedPreview,setSelectedPreview]=useState(null),[uploadProgress,setUploadProgress]=useState(0);
 const [signedUrls,setSignedUrls]=useState({});
 const [previewModal,setPreviewModal]=useState({open:false,item:null,url:"",zoom:1,inverted:false});
 const openPatientEdit=()=>{if(!patient)return;setPatientForm({name:patient.name||"",phone:patient.phone||"",email:patient.email||"",birth:patient.birth||"",cpf:patient.cpf||"",rg:patient.rg||"",address:patient.address||"",responsible:patient.responsible||"",profession:patient.profession||"",notes:patient.notes||""});setEditPatient(true)};
 const savePatient=async()=>{if(!patientForm.name?.trim())return;await update("patients",patient.id,{...patientForm,name:patientForm.name.trim(),status:patient.status||"Ativo"});setPatient(p=>({...p,...patientForm,name:patientForm.name.trim()}));setEditPatient(false);};

 const statuses=[
  {key:"healthy",label:"Hígido",symbol:"",className:"healthy"},
  {key:"caries",label:"Cárie",symbol:"C",className:"caries"},
  {key:"restored",label:"Restaurado",symbol:"R",className:"restored"},
  {key:"fracture",label:"Fratura",symbol:"F",className:"fracture"},
  {key:"filled",label:"Obturação",symbol:"O",className:"filled"},
  {key:"missing",label:"Ausente",symbol:"A",className:"missing"}
];
 useEffect(()=>{if(initialPatientId){const target=data.patients.find(p=>p.id===initialPatientId);if(target)setPatient(target);}},[initialPatientId,data.patients]);
 useEffect(()=>{if(!patient){setToothStates({});setAnam(anamnesisDefaults);return;}const saved=data.records.find(r=>r.kind==="odontogram"&&r.patientId===patient.id);setToothStates(saved?.toothStates||{});
    setInfantToothStates(saved?.infantToothStates||{});const a=data.records.find(r=>r.kind==="anamnesis"&&r.patientId===patient.id);setAnam({...anamnesisDefaults,...(a?.data||{}),alertDetails:{...(a?.data?.alertDetails||{})}});const latest=[...data.records].filter(r=>r.patientId===patient.id&&r.kind==="evolution").sort((a,b)=>String(b.createdAt||b.date||"").localeCompare(String(a.createdAt||a.date||"")))[0];setComplaint(latest?.complaint||"");setDiagnosis(latest?.diagnosis||"");},[patient,data.records]);
const cycleTooth = t => {
  const current = toothStates[t] || "healthy";
  const i = statuses.findIndex(x => x.key === current);
  setToothStates(x => ({ ...x, [t]: statuses[(i + 1) % statuses.length].key }));
};

const cycleInfant = t => {
  const current = infantToothStates[t] || "healthy";
  const i = statuses.findIndex(x => x.key === current);
  setInfantToothStates(x => ({ ...x, [t]: statuses[(i + 1) % statuses.length].key }));
};
 const saveOdontogram=async()=>{if(!patient)return;setSaving(true);const existing=data.records.find(r=>r.kind==="odontogram"&&r.patientId===patient.id),payload={kind:"odontogram",patientId:patient.id,patient:patient.name,toothStates,date:today(),isLocked:false};if(existing)await update("records",existing.id,payload);else await write("records",payload);setSaving(false)};
 const saveEvolution=async()=>{if(!patient||(!note.trim()&&!complaint.trim()&&!diagnosis.trim()))return;await write("records",{kind:"evolution",patientId:patient.id,patient:patient.name,note:note.trim(),complaint:complaint.trim(),diagnosis:diagnosis.trim(),date:today(),isLocked:false});setNote("");};
 const saveAnamnesis=async()=>{if(!patient)return;setSaving(true);const existing=data.records.find(r=>r.kind==="anamnesis"&&r.patientId===patient.id),payload={kind:"anamnesis",clinicId:userId,uid,patientId:patient.id,patient:patient.name,data:{...(existing?.data||{}),...anam},date:today(),isLocked:false};if(existing)await update("records",existing.id,payload);else await write("records",payload);setSaving(false)};
 useEffect(()=>{setLocalAttachments([]);setAttachmentStatus("");setSelectedFile(null);setSelectedPreview(null);setUploadProgress(0);},[patient?.id]);
 const storedAttachments=data.records.filter(r=>r.kind==="attachment"&&String(r.patientId)===String(patient?.id));
 const attachments=[...storedAttachments,...localAttachments.filter(local=>!storedAttachments.some(stored=>stored.id===local.id))].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));

 useEffect(()=>{
  let active=true;
  const loadSigned=async()=>{
    for(const a of attachments){
      if(a.storagePath&&!signedUrls[a.storagePath]){
        try{
          const url=await getSignedAttachmentUrl(a.storagePath,3600);
          if(active&&url){setSignedUrls(prev=>({...prev,[a.storagePath]:url}));}
        }catch(e){}
      }
    }
  };
  if(attachments.length) loadSigned();
  return ()=>{active=false;};
 },[attachments]);

 const onFileSelect=e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  const val=validateAttachmentFile(file);
  if(!val.valid){
    setAttachmentStatus(val.error);
    alert(val.error);
    e.target.value="";
    return;
  }
  setSelectedFile(file);
  if(file.type.startsWith("image/")){
    const reader=new FileReader();
    reader.onload=ev=>setSelectedPreview(ev.target.result);
    reader.readAsDataURL(file);
  }else{
    setSelectedPreview(null);
  }
  const suggestedCat=suggestCategoryFromFileName(file.name);
  const dot=file.name.lastIndexOf(".");
  const base=dot>0?file.name.substring(0,dot):file.name;
  setAttach(prev=>({
    ...prev,
    name:prev.name.trim()||base,
    category:prev.category==="Outros"?suggestedCat:prev.category
  }));
  setAttachmentStatus(`Arquivo pronto: ${file.name} (${formatFileSize(file.size)})`);
 };

 const cancelSelectedFile=()=>{
  setSelectedFile(null);
  setSelectedPreview(null);
  setUploadProgress(0);
  setAttachmentStatus("");
 };

 const executeUpload=async()=>{
  if(!selectedFile||!patient){alert("Selecione um arquivo para anexar.");return;}
  if(!isSupabaseConfigured()){
    const msg="Armazenamento Supabase não configurado. Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.";
    setAttachmentStatus(msg);
    alert(msg);
    return;
  }
  setSaving(true);
  setAttachmentStatus("Enviando arquivo para o Supabase Storage...");
  setUploadProgress(15);
  try{
    const uploaded=await uploadAttachmentFile({
      clinicId:userId,
      patientId:patient.id,
      file:selectedFile,
      onProgress:p=>setUploadProgress(p)
    });
    const attachment={
      kind:"attachment",
      clinicId:userId,
      uid,
      isLocked:false,
      patientId:patient.id,
      patient:patient.name,
      name:attach.name.trim()||selectedFile.name,
      category:attach.category||suggestCategoryFromFileName(selectedFile.name),
      description:attach.description.trim(),
      fileName:selectedFile.name,
      mimeType:selectedFile.type||"application/octet-stream",
      size:selectedFile.size,
      url:uploaded.url,
      storagePath:uploaded.storagePath,
      date:today()
    };
    const id=await write("records",attachment);
    setLocalAttachments(current=>[...current,{...attachment,id}]);
    if(uploaded.url){
      setSignedUrls(prev=>({...prev,[uploaded.storagePath]:uploaded.url}));
    }
    setAttach({category:"Outros",name:"",description:""});
    setSelectedFile(null);
    setSelectedPreview(null);
    setAttachmentStatus("Arquivo anexado com sucesso.");
    alert("Arquivo anexado com sucesso.");
  }catch(err){
    const msg=err?.message||"Não foi possível anexar o arquivo.";
    setAttachmentStatus(msg);
    alert(msg);
  }finally{
    setSaving(false);
    setUploadProgress(0);
  }
 };

 const openViewer=async a=>{
  let url=signedUrls[a.storagePath]||a.url;
  if(!url||!url.startsWith("http")){
    try{
      setAttachmentStatus("Gerando link seguro de visualização...");
      url=await getSignedAttachmentUrl(a.storagePath,3600);
      if(url) setSignedUrls(prev=>({...prev,[a.storagePath]:url}));
      setAttachmentStatus("");
    }catch(e){
      alert("Não foi possível gerar a URL de visualização.");
      return;
    }
  }
  if(a.mimeType?.startsWith("image/")||/\.(jpg|jpeg|png|webp|tif|tiff|bmp|svg)$/i.test(a.fileName||"")){
    setPreviewModal({open:true,item:a,url,zoom:1,inverted:false});
  }else if(a.mimeType==="application/pdf"||(a.fileName||"").toLowerCase().endsWith(".pdf")){
    setPreviewModal({open:true,item:a,url,zoom:1,inverted:false});
  }else{
    window.open(url,"_blank","noopener,noreferrer");
  }
 };

 const handleDownload=async a=>{
  try{
    setAttachmentStatus("Baixando arquivo...");
    await downloadAttachmentFile(a.storagePath,a.fileName);
    setAttachmentStatus("");
  }catch(err){
    const url=signedUrls[a.storagePath]||a.url;
    if(url&&url.startsWith("http")){
      window.open(url,"_blank");
    }else{
      alert("Não foi possível baixar o arquivo.");
    }
    setAttachmentStatus("");
  }
 };

 const delAttachment=async a=>{
  if(!confirm(`Excluir o anexo "${a.name||a.fileName}"?`))return;
  try{
    setSaving(true);
    setAttachmentStatus("Excluindo arquivo...");
    if(a.storagePath){
      await deleteAttachmentFile(a.storagePath).catch(()=>{});
    }
    await remove("records",a.id);
    setLocalAttachments(current=>current.filter(item=>item.id!==a.id));
    setSignedUrls(prev=>{const c={...prev};delete c[a.storagePath];return c;});
    setAttachmentStatus("Arquivo excluído com sucesso.");
  }catch(e){
    setAttachmentStatus("Não foi possível excluir o anexo.");
    alert("Não foi possível excluir o anexo.");
  }finally{
    setSaving(false);
  }
 };

 const history=data.records.filter(r=>r.patientId===patient?.id&&r.kind!=="odontogram"&&r.kind!=="anamnesis"&&r.kind!=="attachment").sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
 const Tooth = ({ n }) => {
  const status = statuses.find(x => x.key === (toothStates[n] || "healthy")) || statuses[0];
  return (
    <button title={`Dente ${n} — ${status.label}`} className={`tooth ${status.className}`} onClick={() => cycleTooth(n)}>
      <span className="toothShape"><i>{status.symbol}</i></span>
      <b>{n}</b>
    </button>
  );
};

const InfantTooth = ({ n }) => {
  const status = statuses.find(x => x.key === (infantToothStates[n] || "healthy")) || statuses[0];
  return (
    <button title={`Dente ${n} — ${status.label}`} className={`tooth ${status.className}`} onClick={() => cycleInfant(n)}>
      <span className="toothShape"><i>{status.symbol}</i></span>
      <b>{n}</b>
    </button>
  );
};
 const initials=patient?.name?.split(" ").map(x=>x[0]).slice(0,2).join("")||"";
 return <div className="recordLayout">
   <section className="panel recordPatients"><div className="recordHeader"><div><h3>Pacientes</h3><small>{data.patients.length} prontuários</small></div></div>{data.patients.map(p=><button className={`patientCard ${patient?.id===p.id?"selected":""}`} key={p.id} onClick={()=>{setPatient(p);setTab("overview")}}><div className="avatar">{p.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><b>{p.name}</b><small>{p.phone||"Sem telefone"}</small></div></button>)}</section>
   <section className="panel recordMain"><div className="recordTop"><div>{patient?<><div className="patientHero"><div className="avatar large">{initials}</div><div><h3>{patient.name}</h3><small>{patient.birth?`Nascimento: ${new Date(patient.birth+"T12:00:00").toLocaleDateString("pt-BR")}`:"Nascimento não informado"} {patient.phone?`• ${patient.phone}`:""}</small></div></div></>:<><h3>Prontuário clínico</h3><small>Selecione um paciente</small></>}</div>{patient&&<div className="recordTopActions"><span className="badge ativo">Paciente ativo</span><button className="secondary" onClick={openPatientEdit}><Pencil size={15}/> Editar ficha</button></div>}</div>
   {!patient?<Empty text="Selecione um paciente para abrir a ficha completa."/>:<>
     <div className="recordTabs"><button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}><UserRound size={15}/> Ficha</button><button className={tab==="anamnesis"?"active":""} onClick={()=>setTab("anamnesis")}><HeartPulse size={15}/> Anamnese</button><button className={tab==="attachments"?"active":""} onClick={()=>setTab("attachments")}><Paperclip size={15}/> Anexos <span className="tabCount">{attachments.length}</span></button><button className={tab==="odontogram"?"active":""} onClick={()=>setTab("odontogram")}>🦷 Odontograma</button><button className={tab==="evolution"?"active":""} onClick={()=>setTab("evolution")}>📋 Evoluções</button><button className={tab==="history"?"active":""} onClick={()=>setTab("history")}>🕘 Histórico</button></div>
     {tab==="overview"&&<div className="patientOverview"><div className="infoCards"><div><span>Telefone</span><b>{patient.phone||"Não informado"}</b></div><div><span>E-mail</span><b>{patient.email||"Não informado"}</b></div><div><span>Nascimento</span><b>{patient.birth?new Date(patient.birth+"T12:00:00").toLocaleDateString("pt-BR"):"Não informado"}</b></div><div><span>Status</span><b>Ativo</b></div></div><div className="sectionTitle"><div><h4>Resumo clínico</h4><small>Informações importantes para o atendimento</small></div><button className="secondary" onClick={()=>setTab("anamnesis")}><HeartPulse size={16}/> Abrir anamnese</button></div><div className="clinicalHighlights"><div><HeartPulse/><span>Alergias</span><b>{anam.allergies||"Não informado"}</b></div><div><ClipboardList/><span>Medicamentos</span><b>{anam.medications||"Não informado"}</b></div><div><FileCheck/><span>Condições relevantes</span><b>{anam.conditions||"Não informado"}</b></div><div><Paperclip/><span>Documentos</span><b>{attachments.length} anexos</b></div></div></div>}
    {tab==="anamnesis"&&<AnamnesisForm anam={anam} setAnam={setAnam} patient={patient} saving={saving} save={saveAnamnesis}/>} 
    {tab==="attachments"&&<div className="attachmentsPanel"><div className="sectionTitle"><div><h4>Documentos e arquivos do paciente</h4><small>Radiografias, fotos, atestados, contratos, termos e outros anexos.</small></div></div><div className="uploadBox"><div className="uploadIcon">{selectedPreview?<img src={selectedPreview} alt="Prévia" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"11px"}}/>:<Paperclip/>}</div><div><b>{selectedFile?`Arquivo: ${selectedFile.name}`:"Adicionar um novo arquivo"}</b><small>{selectedFile?`${formatFileSize(selectedFile.size)} • Pronto para envio`:"Até 15 MB por arquivo. Imagens, PDF e documentos são aceitos."}</small></div><div className="uploadFields"><Input label="Nome do arquivo" v={attach.name} set={v=>setAttach({...attach,name:v})}/><label>Categoria<select value={attach.category} onChange={e=>setAttach({...attach,category:e.target.value})}>{ATTACHMENT_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></label><Input label="Observação" v={attach.description} set={v=>setAttach({...attach,description:v})}/></div>{!selectedFile?<label className="fileButton primary"><Plus size={17}/> Selecionar arquivo<input type="file" onChange={onFileSelect} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" hidden/></label>:<div style={{display:"flex",gap:"8px",alignItems:"center"}}><button type="button" className="secondary" onClick={cancelSelectedFile} disabled={saving} title="Cancelar seleção"><X size={15}/></button><button type="button" className="primary fileButton" onClick={executeUpload} disabled={saving}><Plus size={17}/> {saving?(uploadProgress?`Enviando (${uploadProgress}%)...`:"Enviando..."):"Enviar arquivo"}</button></div>}{attachmentStatus&&<small className="attachmentStatus">{attachmentStatus}</small>}{saving&&uploadProgress>0&&<div style={{gridColumn:"1/-1",height:"4px",background:"#edf0f5",borderRadius:"99px",overflow:"hidden",marginTop:"2px"}}><div style={{width:`${uploadProgress}%`,height:"100%",background:"#2563eb",transition:"width 0.2s ease"}}/></div>}</div><div className="attachmentList">{attachments.length?attachments.map(a=>{const url=signedUrls[a.storagePath]||a.url;const isImg=a.mimeType?.startsWith("image/")||/\.(jpg|jpeg|png|webp|tif|tiff|bmp|svg)$/i.test(a.fileName||a.name||"");return <div className="attachmentCard" key={a.id}><div className="attachmentIcon" onClick={()=>isImg&&openViewer(a)} style={{cursor:isImg?"pointer":"default"}}>{isImg&&url?<img src={url} alt={a.name} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"10px"}}/>:isImg?<ImageIcon/>:<FileText/>}</div><div className="attachmentInfo"><b>{a.name}</b><small>{a.category} • {a.date||"Sem data"} • {a.fileName} {a.size?`• ${formatFileSize(a.size)}`:""}</small>{a.description&&<p>{a.description}</p>}</div><div className="attachmentActions"><button type="button" className="iconBtn" onClick={()=>openViewer(a)} title="Visualizar"><Eye size={17}/></button><button type="button" className="iconBtn" onClick={()=>handleDownload(a)} title="Baixar"><Download size={17}/></button><button type="button" className="iconBtn dangerBtn" onClick={()=>delAttachment(a)} title="Excluir"><Trash2 size={17}/></button></div></div>}):<Empty text="Nenhum arquivo anexado a este paciente."/>}</div></div>}
     {tab==="odontogram" && (
  <div className="odontogramWrap">
    <div className="odontoToolbar">
      <div>
        <b>Odontograma</b>
        <small>Dentição mista • 32 permanentes + 20 decíduos</small>
      </div>
      <button className="primary" onClick={saveOdontogram} disabled={saving}>
        <CheckCircle size={17}/> {saving?"Salvando...":"Salvar odontograma"}
      </button>
    </div>
    <div className="odontoLegend">
      {statuses.map(x => (
        <span key={x.key}><i className={`legendDot ${x.className}`}></i>{x.label}</span>
      ))}
    </div>
    <div className="jaw">
      <div className="jawLabel">MAXILA</div>
      <div className="groupLabel">PERMANENTES</div>
      <div className="teethRow">{permanentUpper.map(n => <Tooth key={n} n={n} />)}</div>
      <div className="groupLabel">DECÍDUOS</div>
      <div className="teethRow infantRow">{[...infantUpperRight, ...infantUpperLeft].map(n => <InfantTooth key={n} n={n} />)}</div>
      <div className="midline"></div>
      <div className="jawLabel">MANDÍBULA</div>
      <div className="groupLabel">PERMANENTES</div>
      <div className="teethRow">{permanentLower.map(n => <Tooth key={n} n={n} />)}</div>
      <div className="groupLabel">DECÍDUOS</div>
      <div className="teethRow infantRow">{[...infantLowerLeft, ...infantLowerRight].map(n => <InfantTooth key={n} n={n} />)}</div>
    </div>
    <div className="odontoSummary">
      <b>Resumo:</b> {Object.values(toothStates).filter(x=>x==="caries").length} cáries • {Object.values(toothStates).filter(x=>x==="restored").length} restaurados • {Object.values(toothStates).filter(x=>x==="planned").length} planejados • {Object.values(toothStates).filter(x=>x==="missing").length} ausentes
    </div>
  </div>
)}
     {tab==="evolution"&&<div className="evolutionPanel"><div className="clinicalGrid"><label>Queixa principal<textarea value={complaint} onChange={e=>setComplaint(e.target.value)} placeholder="O que trouxe o paciente à consulta?"/></label><label>Diagnóstico / hipótese<textarea value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} placeholder="Diagnóstico ou hipótese clínica..."/></label></div><label>Evolução clínica<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Descreva a evolução, procedimentos realizados, orientações e observações..."/></label><button className="primary" onClick={saveEvolution}><CheckCircle size={17}/> Salvar evolução</button></div>}
     {tab==="history"&&<div className="recordList">{history.length?history.map(r=><div className="recordNote" key={r.id}><FileText/><div><b>{r.date||"Sem data"}</b>{r.complaint&&<p><strong>Queixa:</strong> {r.complaint}</p>}{r.diagnosis&&<p><strong>Diagnóstico:</strong> {r.diagnosis}</p>}{r.note&&<p>{r.note}</p>}</div></div>):<Empty text="Nenhuma evolução registrada para este paciente."/>}</div>}
   </>}{editPatient&&<Modal title="Editar dados do paciente" close={()=>setEditPatient(false)}><div className="formGrid clinicalGrid"><Input label="Nome completo" v={patientForm.name} set={v=>setPatientForm({...patientForm,name:v})}/><Input label="Data de nascimento" type="date" v={patientForm.birth} set={v=>setPatientForm({...patientForm,birth:v})}/><Input label="Telefone / WhatsApp" v={patientForm.phone} set={v=>setPatientForm({...patientForm,phone:v})}/><Input label="E-mail" type="email" v={patientForm.email} set={v=>setPatientForm({...patientForm,email:v})}/><Input label="CPF" v={patientForm.cpf} set={v=>setPatientForm({...patientForm,cpf:v})}/><Input label="RG" v={patientForm.rg} set={v=>setPatientForm({...patientForm,rg:v})}/><Input label="Responsável" v={patientForm.responsible} set={v=>setPatientForm({...patientForm,responsible:v})}/><Input label="Profissão" v={patientForm.profession} set={v=>setPatientForm({...patientForm,profession:v})}/><label>Endereço<textarea value={patientForm.address||""} onChange={e=>setPatientForm({...patientForm,address:e.target.value})}/></label><label>Observações<textarea value={patientForm.notes||""} onChange={e=>setPatientForm({...patientForm,notes:e.target.value})}/></label></div><button className="primary full" onClick={savePatient}>Salvar dados do paciente</button></Modal>}{previewModal.open&&<Modal title={previewModal.item?.name||"Visualizar anexo"} className="largeModal" close={()=>setPreviewModal({open:false,item:null,url:"",zoom:1,inverted:false})}>{previewModal.item?.mimeType?.startsWith("image/")||/\.(jpg|jpeg|png|webp|tif|tiff|bmp|svg)$/i.test(previewModal.item?.fileName||"")?<div><div className="rxToolbar"><button type="button" className="secondary" onClick={()=>setPreviewModal(prev=>({...prev,zoom:Math.min(prev.zoom+0.25,3)}))} title="Aumentar zoom"><ZoomIn size={15}/> Zoom +</button><button type="button" className="secondary" onClick={()=>setPreviewModal(prev=>({...prev,zoom:Math.max(prev.zoom-0.25,0.5)}))} title="Diminuir zoom"><ZoomOut size={15}/> Zoom -</button><button type="button" className={`secondary ${previewModal.inverted?"active":""}`} onClick={()=>setPreviewModal(prev=>({...prev,inverted:!prev.inverted}))} title="Inverter contraste radiográfico">RX Negativo</button><button type="button" className="secondary" onClick={()=>setPreviewModal(prev=>({...prev,zoom:1,inverted:false}))} title="Restaurar visualização">Reset</button><a className="secondary" href={previewModal.url} target="_blank" rel="noreferrer" title="Abrir em nova aba"><ExternalLink size={15}/> Nova aba</a></div><div className="rxViewport"><img src={previewModal.url} alt={previewModal.item?.name} style={{transform:`scale(${previewModal.zoom})`,filter:previewModal.inverted?"invert(1) contrast(1.15)":"none"}}/></div></div>:previewModal.item?.mimeType==="application/pdf"||(previewModal.item?.fileName||"").toLowerCase().endsWith(".pdf")?<div style={{height:"65vh"}}><iframe src={previewModal.url} title={previewModal.item?.name} style={{width:"100%",height:"100%",border:0,borderRadius:"8px"}}/></div>:<div style={{padding:"20px",textAlign:"center"}}><FileText size={48} style={{color:"#2563eb",marginBottom:"12px"}}/><h4>{previewModal.item?.name}</h4><p style={{color:"#667085"}}>{previewModal.item?.fileName} • {formatFileSize(previewModal.item?.size)}</p><a className="primary" href={previewModal.url} target="_blank" rel="noreferrer" style={{marginTop:"12px"}}><ExternalLink size={16}/> Abrir em nova aba</a></div>}<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"16px",paddingTop:"14px",borderTop:"1px solid #edf0f5"}}><small style={{color:"#8992a3"}}>{previewModal.item?.category} • {previewModal.item?.date||"Sem data"} {previewModal.item?.size?`• ${formatFileSize(previewModal.item?.size)}`:""}</small><button className="primary" onClick={()=>handleDownload(previewModal.item)}><Download size={16}/> Baixar arquivo</button></div></Modal>}</section></div>;
}
function Finance({data,update,write,can}){const [open,setOpen]=useState(false),[form,setForm]=useState({patient:"",description:"",value:"",status:"Pendente",date:today()});useEffect(()=>{const h=()=>{if(can("Financeiro","finances.create"))setOpen(true)};window.addEventListener("newItem",h);return()=>window.removeEventListener("newItem",h)},[can]);const add=async()=>{if(!form.description)return;await write("finances",{...form,value:Number(form.value||0)});setOpen(false)};return <section className="panel"><div className="toolbar"><div><h3>Financeiro</h3><small>Contas, recebimentos e lançamentos</small></div>{can("Financeiro","finances.create")&&<button className="primary" onClick={()=>setOpen(true)}><Plus size={18}/> Lançamento</button>}</div><div className="table"><div className="tr th"><span>Paciente</span><span>Descrição</span><span>Valor</span><span>Status</span><span></span></div>{data.finances.map(f=><div className="tr" key={f.id}><span><b>{f.patient||"—"}</b></span><span>{f.description}</span><span><b>{money(f.value)}</b></span><span><span className={"badge "+String(f.status||"").toLowerCase()}>{f.status}</span></span><span>{can("Financeiro","finances.payments")&&<button className="iconBtn" onClick={()=>update("finances",f.id,{status:"Pago"})}><CheckCircle size={16}/></button>}</span></div>)}</div>{open&&<Modal title="Novo lançamento" close={()=>setOpen(false)}><Input label="Paciente" v={form.patient} set={v=>setForm({...form,patient:v})}/><Input label="Descrição" v={form.description} set={v=>setForm({...form,description:v})}/><Input label="Valor" type="number" v={form.value} set={v=>setForm({...form,value:v})}/><button className="primary full" onClick={add}>Salvar lançamento</button></Modal>}</section>}
function Stock({data,update,write,remove}){
 const empty={name:"",category:"Materiais",unit:"un",quantity:0,min:0,cost:0,supplier:"",location:"",expiry:""};
 const [open,setOpen]=useState(false),[movement,setMovement]=useState(null),[editing,setEditing]=useState(null),[search,setSearch]=useState(""),[filter,setFilter]=useState("Todos"),[form,setForm]=useState(empty),[moveQty,setMoveQty]=useState(1);
 useEffect(()=>{const h=()=>{setEditing(null);setForm(empty);setOpen(true)};window.addEventListener("newItem",h);return()=>window.removeEventListener("newItem",h)},[]);
 const categories=["Todos",...Array.from(new Set(data.stock.map(s=>s.category||"Materiais")))];
 const list=data.stock.filter(s=>(s.name||"").toLowerCase().includes(search.toLowerCase())).filter(s=>filter==="Todos"||(s.category||"Materiais")===filter);
 const low=data.stock.filter(s=>Number(s.quantity||0)<=Number(s.min||0));
 const totalUnits=data.stock.reduce((a,s)=>a+Number(s.quantity||0),0);
 const totalValue=data.stock.reduce((a,s)=>a+(Number(s.quantity||0)*Number(s.cost||0)),0);
 const set=(k,v)=>setForm(f=>({...f,[k]:v}));
 const save=async()=>{if(!form.name.trim())return;const payload={...form,quantity:Number(form.quantity)||0,min:Number(form.min)||0,cost:Number(form.cost)||0};if(editing)await update("stock",editing.id,payload);else await write("stock",payload);setOpen(false);setEditing(null);setForm(empty)};
 const startEdit=s=>{setEditing(s);setForm({name:s.name||"",category:s.category||"Materiais",unit:s.unit||"un",quantity:s.quantity||0,min:s.min||0,cost:s.cost||0,supplier:s.supplier||"",location:s.location||"",expiry:s.expiry||""});setOpen(true)};
 const doMovement=async()=>{if(!movement)return;const qty=Math.max(1,Number(moveQty)||1),current=Number(movement.item.quantity)||0,next=movement.type==="in"?current+qty:Math.max(0,current-qty);await update("stock",movement.item.id,{quantity:next,lastMovement:{type:movement.type,quantity:qty,date:new Date().toISOString()}});setMovement(null);setMoveQty(1)};
 const stockRows=list.map(s=>{
  const isLow=Number(s.quantity||0)<=Number(s.min||0);
  const isExpired=Boolean(s.expiry)&&Date.now()>new Date(s.expiry).getTime();
  return <div className="stockLine" key={s.id}>
   <div><b>{s.name}</b><small>{s.supplier||"Sem fornecedor"}{s.location?` • ${s.location}`:""}</small></div>
   <span>{s.category||"Materiais"}</span>
   <strong className={isLow?"low":""}>{s.quantity} <small>{s.unit||"un"}</small></strong>
   <span>{s.min} {s.unit||"un"}</span>
   <span>{money(s.cost||0)}</span>
   <span className={isExpired?"expired":""}>{s.expiry?new Date(s.expiry).toLocaleDateString("pt-BR"):"—"}</span>
   <div className="stockActions">
    <button className="iconBtn" title="Entrada" onClick={()=>setMovement({item:s,type:"in"})}><ArrowDownToLine size={17}/></button>
    <button className="iconBtn" title="Saída" onClick={()=>setMovement({item:s,type:"out"})}><ArrowUpFromLine size={17}/></button>
    <button className="iconBtn" title="Editar" onClick={()=>startEdit(s)}><Pencil size={16}/></button>
    <button className="iconBtn dangerBtn" title="Excluir" onClick={()=>remove("stock",s.id)}><Trash2 size={16}/></button>
   </div>
  </div>;
 });
 return <>
 <div className="stockSummary">
  <div className="stockStat"><div className="stockStatIcon"><Boxes size={19}/></div><span>Itens cadastrados</span><b>{data.stock.length}</b></div>
  <div className="stockStat"><div className="stockStatIcon"><Package size={19}/></div><span>Unidades em estoque</span><b>{totalUnits}</b></div>
  <div className="stockStat"><div className="stockStatIcon"><DollarSign size={19}/></div><span>Valor estimado</span><b>{money(totalValue)}</b></div>
  <div className="stockStat danger"><div className="stockStatIcon"><AlertTriangle size={19}/></div><span>Abaixo do mínimo</span><b>{low.length}</b></div>
 </div>
 <section className="panel">
  <div className="toolbar"><div><h3>Controle de estoque</h3><small>Materiais, consumo, reposição e validade</small></div><button className="primary" onClick={()=>{setEditing(null);setForm(empty);setOpen(true)}}><Plus size={18}/> Novo item</button></div>
  <div className="stockFilters"><div className="stockSearch"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar material..."/></div><div className="filterPills">{categories.map(c=><button key={c} className={filter===c?"active":""} onClick={()=>setFilter(c)}>{c}</button>)}</div></div>
  {low.length>0&&<div className="stockAlert"><AlertTriangle size={18}/><div><b>{low.length} {low.length===1?"item precisa":"itens precisam"} de reposição</b><small>{low.slice(0,4).map(x=>x.name).join(" • ")}{low.length>4?" • ...":""}</small></div></div>}
  <div className="stockTable"><div className="stockHead"><span>Material</span><span>Categoria</span><span>Quantidade</span><span>Mínimo</span><span>Custo</span><span>Validade</span><span>Ações</span></div>
  {stockRows}
  {!list.length&&<Empty text="Nenhum item encontrado."/>}
  </div>
 </section>
 {open&&<Modal title={editing?"Editar item":"Novo item"} close={()=>{setOpen(false);setEditing(null)}}><div className="formGrid"><Input label="Nome do material" v={form.name} set={v=>set("name",v)}/><label>Categoria<select value={form.category} onChange={e=>set("category",e.target.value)}><option>Materiais</option><option>EPIs</option><option>Instrumentais</option><option>Consumíveis</option><option>Medicamentos</option><option>Laboratório</option><option>Higiene</option></select></label><label>Unidade<select value={form.unit} onChange={e=>set("unit",e.target.value)}><option value="un">Unidade</option><option value="cx">Caixa</option><option value="pct">Pacote</option><option value="ml">mL</option><option value="l">Litro</option><option value="g">Grama</option></select></label><Input label="Quantidade" type="number" v={form.quantity} set={v=>set("quantity",v)}/><Input label="Estoque mínimo" type="number" v={form.min} set={v=>set("min",v)}/><Input label="Custo unitário (R$)" type="number" v={form.cost} set={v=>set("cost",v)}/><Input label="Fornecedor" v={form.supplier} set={v=>set("supplier",v)}/><Input label="Localização" v={form.location} set={v=>set("location",v)}/><Input label="Validade" type="date" v={form.expiry} set={v=>set("expiry",v)}/></div><button className="primary full" onClick={save}>{editing?"Salvar alterações":"Cadastrar item"}</button></Modal>}
 {movement&&<Modal title={movement.type==="in"?"Registrar entrada":"Registrar saída"} close={()=>setMovement(null)}><p className="movementText"><b>{movement.item.name}</b><br/>Saldo atual: {movement.item.quantity} {movement.item.unit||"un"}</p><Input label="Quantidade" type="number" v={moveQty} set={setMoveQty}/><button className="primary full" onClick={doMovement}>{movement.type==="in"?"Confirmar entrada":"Confirmar saída"}</button></Modal>}
 </>
}
function Professionals({data,write,remove,clinicId,role}){
 const [tab,setTab]=useState("professionals"),[open,setOpen]=useState(false),[employeeOpen,setEmployeeOpen]=useState(false),[members,setMembers]=useState([]),[saving,setSaving]=useState(false);
 const [form,setForm]=useState({name:"",specialty:"",status:"Ativo"});
 const [employee,setEmployee]=useState({name:"",email:"",phone:"",role:"dentist",password:"",permissions:["Agenda"]});
 const canManage=role==="owner"||role==="admin";
 const roles=[{value:"admin",label:"Administrador"},{value:"dentist",label:"Dentista"},{value:"secretary",label:"Secretária"},{value:"reception",label:"Recepção"},{value:"assistant",label:"Auxiliar"},{value:"finance",label:"Financeiro"}];
 const permissionOptions=["Agenda","Pacientes","Prontuários","Odontograma","Evoluções","Anamnese","Anexos","Financeiro","Relatórios","Estoque"];
 useEffect(()=>{if(!clinicId||!canManage)return;getClinicMembers(clinicId).then(setMembers).catch(()=>{});},[clinicId,canManage]);
 const addProfessional=async()=>{if(!form.name.trim())return;await write("professionals",form);setForm({name:"",specialty:"",status:"Ativo"});setOpen(false)};
 const addEmployee=async()=>{if(!employee.name.trim()||!employee.email.trim()||employee.password.length<6)return;setSaving(true);try{const account=await createEmployeeAccount(employee.email.trim(),employee.password,employee.name.trim());await addClinicMember(clinicId,account,employee.role,{phone:employee.phone,permissions:employee.permissions});setMembers(await getClinicMembers(clinicId));setEmployee({name:"",email:"",phone:"",role:"dentist",password:"",permissions:["Agenda"]});setEmployeeOpen(false)}catch(error){alert(error.code==="auth/email-already-in-use"?"Este e-mail já possui uma conta.":"Não foi possível cadastrar o funcionário.")}finally{setSaving(false)}};
 return <section className="panel"><div className="toolbar"><div><h3>Equipe e profissionais</h3><small>Gerencie os profissionais e os acessos da clínica.</small></div>{tab==="professionals"?<button className="primary" onClick={()=>setOpen(true)}><Plus size={18}/> Novo profissional</button>:canManage&&<button className="primary" onClick={()=>setEmployeeOpen(true)}><UserPlus size={18}/> Novo funcionário</button>}</div><div className="recordTabs teamTabs"><button className={tab==="professionals"?"active":""} onClick={()=>setTab("professionals")}>Profissionais</button><button className={tab==="team"?"active":""} onClick={()=>setTab("team")}>Equipe</button></div>{tab==="professionals"?data.professionals.map(p=><div className="professional" key={p.id}><div className="avatar">DR</div><div><b>{p.name}</b><small>{p.specialty}</small></div><span className="badge ativo">{p.status}</span><button className="iconBtn" onClick={()=>remove("professionals",p.id)}><Trash2 size={16}/></button></div>):<div className="teamList">{!canManage&&<p className="empty">Somente administradores podem gerenciar a equipe.</p>}{members.map(member=><div className="professional" key={member.id}><div className="avatar">{member.name?.slice(0,2).toUpperCase()}</div><div><b>{member.name}</b><small>{member.email} • {roles.find(item=>item.value===member.role)?.label||member.role}</small></div><span className="badge ativo">{member.status||"Ativo"}</span></div>)}</div>}{open&&<Modal title="Novo profissional" close={()=>setOpen(false)}><Input label="Nome" v={form.name} set={v=>setForm({...form,name:v})}/><Input label="Especialidade" v={form.specialty} set={v=>setForm({...form,specialty:v})}/><button className="primary full" onClick={addProfessional}>Cadastrar</button></Modal>}{employeeOpen&&<Modal title="Novo funcionário" close={()=>setEmployeeOpen(false)}><Input label="Nome completo" v={employee.name} set={v=>setEmployee({...employee,name:v})}/><Input label="E-mail" type="email" v={employee.email} set={v=>setEmployee({...employee,email:v})}/><Input label="Telefone" v={employee.phone} set={v=>setEmployee({...employee,phone:v})}/><Input label="Senha inicial" type="password" v={employee.password} set={v=>setEmployee({...employee,password:v})}/><label>Cargo<select value={employee.role} onChange={event=>setEmployee({...employee,role:event.target.value})}>{roles.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label><div className="permissionPicker"><b>Permissões</b>{permissionOptions.map(item=><label key={item}><input type="checkbox" checked={employee.permissions.includes(item)} onChange={event=>setEmployee({...employee,permissions:event.target.checked?[...employee.permissions,item]:employee.permissions.filter(permission=>permission!==item)})}/>{item}</label>)}</div><button className="primary full" disabled={saving} onClick={addEmployee}>{saving?"Criando conta...":"Criar funcionário"}</button></Modal>}</section>;
}
function ProfessionalManager({data,write,clinicId,role}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(null),[saving,setSaving]=useState(false),[members,setMembers]=useState([]);
 const calendarColors=["#2563eb","#7c3aed","#0f766e","#c2410c","#be123c","#4f46e5"];
 const canManage=role==="owner"||role==="admin";
 const permissions=["patients.view","patients.create","patients.edit","patients.delete","appointments.view","appointments.create","appointments.edit","appointments.confirm","appointments.cancel","appointments.delete","records.view","records.create","records.edit","records.delete","finances.view","finances.create","finances.edit","finances.payments","stock.view","stock.create","stock.edit","stock.delete","stock.in","stock.out","professionals.view","professionals.create","professionals.edit","professionals.block","professionals.delete","reports.view","settings.view","settings.edit"];
 const labels={"patients.view":"Visualizar pacientes","patients.create":"Criar pacientes","patients.edit":"Editar pacientes","patients.delete":"Excluir pacientes","appointments.view":"Visualizar agenda","appointments.create":"Criar consultas","appointments.edit":"Editar consultas","appointments.confirm":"Confirmar consultas","appointments.cancel":"Cancelar consultas","appointments.delete":"Excluir consultas","records.view":"Visualizar prontuários","records.create":"Criar evolução","records.edit":"Editar prontuário","records.delete":"Excluir informações","finances.view":"Visualizar financeiro","finances.create":"Criar lançamentos","finances.edit":"Editar lançamentos","finances.payments":"Registrar pagamentos","stock.view":"Visualizar estoque","stock.create":"Criar itens","stock.edit":"Editar itens","stock.delete":"Excluir itens","stock.in":"Registrar entrada","stock.out":"Registrar saída","professionals.view":"Visualizar equipe","professionals.create":"Criar profissionais","professionals.edit":"Editar profissionais","professionals.block":"Bloquear profissionais","professionals.delete":"Excluir profissionais","reports.view":"Visualizar relatórios","settings.view":"Visualizar configurações","settings.edit":"Alterar configurações"};
 const empty={name:"",email:"",phone:"",whatsapp:"",cpf:"",rg:"",birth:"",address:"",profession:"",position:"",specialty:"",cro:"",croState:"",hireDate:"",status:"Ativo",role:"Outro",calendarColor:calendarColors[data.professionals.length%calendarColors.length],permissions:["appointments.view"]};
 const [form,setForm]=useState(empty);
 useEffect(()=>{if(clinicId&&canManage)getClinicMembers(clinicId).then(setMembers).catch(()=>{});},[clinicId,canManage]);
 useEffect(()=>{const handler=event=>setForm(value=>({...value,calendarColor:event.detail}));window.addEventListener("professionalColorChange",handler);return()=>window.removeEventListener("professionalColorChange",handler)},[]);
 useEffect(()=>{const handler=()=>{if(canManage){window.__professionalCalendarColor=empty.calendarColor;setSelected(null);setForm(empty);setOpen(true)}};window.addEventListener("newItem",handler);return()=>window.removeEventListener("newItem",handler)},[canManage,empty.calendarColor]);
 const openProfile=profile=>{const member=members.find(item=>item.uid===profile.accessUid);const calendarColor=profile.calendarColor||calendarColors[data.professionals.findIndex(item=>item.id===profile.id)%calendarColors.length];window.__professionalCalendarColor=calendarColor;setSelected(profile);setForm({...empty,...profile,calendarColor,...(member||{}),permissions:member?.permissions||profile.permissions||[]});setOpen(true)};
 const saveProfile=async()=>{if(!form.name.trim())return;if(!selected&&form.loginEmail&&(!form.initialPassword||form.initialPassword!==form.confirmPassword)){alert("A senha e a confirmação precisam ser iguais.");return;}setSaving(true);try{let accessUid=form.uid||form.accessUid;if(!accessUid&&form.loginEmail&&form.initialPassword){const account=await createEmployeeAccount(form.loginEmail.trim(),form.initialPassword,form.name.trim());accessUid=account.uid;await addClinicMember(clinicId,account,form.role,{phone:form.phone,permissions:form.permissions,status:form.accessStatus||"Ativo"});}const profile={...form,accessUid,uid:accessUid};delete profile.initialPassword;delete profile.confirmPassword;delete profile.loginEmail;await (selected?updateItem(clinicId,"professionals",selected.id,profile):addItem(clinicId,"professionals",profile));if(accessUid)await updateClinicMember(clinicId,accessUid,{uid:accessUid,clinicId,name:form.name,email:form.loginEmail||form.email,phone:form.phone,whatsapp:form.whatsapp,cpf:form.cpf,rg:form.rg,birth:form.birth,address:form.address,profession:form.profession,position:form.position,specialty:form.specialty,cro:form.cro,croState:form.croState,hireDate:form.hireDate,role:form.role,permissions:form.permissions,status:form.accessStatus||form.status||"Ativo",notes:form.notes});setMembers(await getClinicMembers(clinicId));setOpen(false);setSelected(null)}catch(error){alert(error.code==="auth/email-already-in-use"?"Este e-mail já possui uma conta.":"Não foi possível salvar o profissional.")}finally{setSaving(false)}};
 const newProfile=()=>{window.__professionalCalendarColor=empty.calendarColor;setSelected(null);setForm(empty);setOpen(true)};
 return <section className="panel"><div className="toolbar"><div><h3>Profissionais</h3><small>Selecione um profissional para abrir a ficha completa.</small></div>{canManage&&<button className="primary" onClick={newProfile}><Plus size={18}/> Novo profissional</button>}</div><div className="professionalList">{data.professionals.map(profile=><button className="professional" key={profile.id} onClick={()=>openProfile(profile)}><div className="avatar">{profile.name?.slice(0,2).toUpperCase()}</div><div><b>{profile.name}</b><small>{profile.specialty||profile.position||"Profissional"}</small></div><span className={`badge ${String(profile.status||"Ativo").toLowerCase()}`}>{profile.status||"Ativo"}</span><Pencil size={16}/></button>)}{!data.professionals.length&&<Empty text="Nenhum profissional cadastrado."/>}</div>{open&&<Modal title={selected?"Ficha do profissional":"Novo profissional"} close={()=>{setOpen(false);setSelected(null)}}><div className="formGrid"><Input label="Nome completo" v={form.name} set={v=>setForm({...form,name:v})}/><Input label="E-mail" type="email" v={form.email||form.loginEmail} set={v=>setForm({...form,email:v,loginEmail:v})}/><Input label="CPF" v={form.cpf} set={v=>setForm({...form,cpf:v})}/><Input label="RG" v={form.rg} set={v=>setForm({...form,rg:v})}/><Input label="Data de nascimento" type="date" v={form.birth} set={v=>setForm({...form,birth:v})}/><Input label="Telefone" v={form.phone} set={v=>setForm({...form,phone:v})}/><Input label="WhatsApp" v={form.whatsapp} set={v=>setForm({...form,whatsapp:v})}/><Input label="Endereço" v={form.address} set={v=>setForm({...form,address:v})}/><Input label="Profissão" v={form.profession} set={v=>setForm({...form,profession:v})}/><Input label="Cargo / função" v={form.position} set={v=>setForm({...form,position:v})}/><Input label="Especialidade" v={form.specialty} set={v=>setForm({...form,specialty:v})}/><Input label="CRO" v={form.cro} set={v=>setForm({...form,cro:v})}/><Input label="UF do CRO" v={form.croState} set={v=>setForm({...form,croState:v})}/><Input label="Data de contratação" type="date" v={form.hireDate} set={v=>setForm({...form,hireDate:v})}/><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value,accessStatus:e.target.value})}><option>Ativo</option><option>Inativo</option><option>Bloqueado</option></select></label><label>Observações<textarea value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div><h4>ACESSO AO SISTEMA</h4><div className="formGrid"><Input label="E-mail de login" type="email" v={form.loginEmail||form.email} set={v=>setForm({...form,loginEmail:v,email:v})}/>{!selected&&<><Input label="Senha inicial" type="password" v={form.initialPassword||""} set={v=>setForm({...form,initialPassword:v})}/><Input label="Confirmar senha" type="password" v={form.confirmPassword||""} set={v=>setForm({...form,confirmPassword:v})}/></>}<label>Status do acesso<select value={form.accessStatus||form.status||"Ativo"} onChange={e=>setForm({...form,accessStatus:e.target.value,status:e.target.value})}><option>Ativo</option><option>Bloqueado</option></select></label><label>Perfil / função<input value={form.role||"Outro"} onChange={e=>setForm({...form,role:e.target.value})}/></label></div><h4>Permissões de acesso</h4><div className="permissionPicker">{permissions.map(key=><label key={key}><input type="checkbox" checked={(form.permissions||[]).includes(key)} onChange={e=>setForm({...form,permissions:e.target.checked?[...(form.permissions||[]),key]:(form.permissions||[]).filter(item=>item!==key)})}/>{labels[key]}</label>)}</div><button className="primary full" disabled={saving} onClick={saveProfile}>{saving?"Salvando...":"Salvar profissional"}</button></Modal>}</section>;
}
function Reports({data}){return <><div className="cards"><Card icon={Users} title="Total pacientes" value={data.patients.length} note="Base cadastrada"/><Card icon={CalendarDays} title="Consultas" value={data.appointments.length} note="Agenda"/><Card icon={DollarSign} title="Movimentado" value={money(data.finances.reduce((a,b)=>a+Number(b.value||0),0))} note="Lançamentos"/><Card icon={Package} title="Itens estoque" value={data.stock.length} note="Cadastrados"/></div><section className="panel"><h3>Indicadores</h3><div className="quick"><span>Pagamentos recebidos: <b>{money(data.finances.filter(x=>x.status==="Pago").reduce((a,b)=>a+Number(b.value||0),0))}</b></span><span>Contas pendentes: <b>{money(data.finances.filter(x=>x.status!=="Pago").reduce((a,b)=>a+Number(b.value||0),0))}</b></span><span>Estoque abaixo do mínimo: <b>{data.stock.filter(x=>Number(x.quantity)<Number(x.min)).length}</b></span></div></section></>}
function SettingsPage({clinic,save}){const [form,setForm]=useState({name:clinic?.name||"",phone:clinic?.phone||"",address:clinic?.address||""});useEffect(()=>setForm({name:clinic?.name||"",phone:clinic?.phone||"",address:clinic?.address||""}),[clinic]);return <section className="panel settings"><h3>Configurações da clínica</h3><label>Nome da clínica<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Telefone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>Endereço<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label><button className="primary" onClick={() => save(form)}>Salvar alterações</button>{APK_DOWNLOAD_URL ? (<a href={APK_DOWNLOAD_URL} className="secondary" style={{marginLeft:"0.5rem"}} download><Download size={18}/> Baixar APK Android</a>) : (<button className="secondary" disabled title="URL do APK não configurada" style={{marginLeft:"0.5rem"}}>Baixar APK Android</button>)}</section>}
function Modal({title,close,children,className=""}){return <div className="overlay"><div className={`modal ${className}`}><div className="modalHead"><h3>{title}</h3><button onClick={close}>×</button></div>{children}</div></div>}
function Input({label,v,set,type="text"}){return <label>{label}<input type={type} value={v} onChange={e=>set(e.target.value)}/>{label==="UF do CRO"&&<><span>Cor na agenda</span><input className="colorPicker" type="color" defaultValue={window.__professionalCalendarColor||"#2563eb"} onChange={e=>window.dispatchEvent(new CustomEvent("professionalColorChange",{detail:e.target.value}))}/></>}</label>}
function Empty({text}){return <div className="empty">{text}</div>}
export default App;
