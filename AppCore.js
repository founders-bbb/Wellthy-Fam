import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
  Animated, Dimensions, BackHandler, Share, Clipboard, Image, Switch, Linking,
  Appearance, RefreshControl,
} from 'react-native';
import { NavigationContainer, useNavigation, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
// B8: Haptics and gesture handler
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView, PanGestureHandler, State as GHState } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PieChart, BarChart, LineChart } from 'react-native-chart-kit';
import { supabase, EDGE_MEAL, EDGE_NUDGE } from './utils/supabaseClient';
import { DB_COLUMNS } from './utils/constants';

// Notification handler — shows alert when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

var AppContext = createContext();
function useApp() { return useContext(AppContext); }

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
var SLOTS = [
  { bg:'#E1F5EE', text:'#085041' },{ bg:'#FBEAF0', text:'#72243E' },
  { bg:'#E6F1FB', text:'#0C447C' },{ bg:'#FAEEDA', text:'#633806' },
  { bg:'#EEEDFE', text:'#3C3489' },
];
var CATS = {
  'Daily Essentials':{bg:'#E1F5EE',text:'#085041'},
  'House Bills':{bg:'#E6F1FB',text:'#0C447C'},
  Travel:{bg:'#FAEEDA',text:'#633806'},
  Health:{bg:'#FBEAF0',text:'#72243E'},
  Lifestyle:{bg:'#EEEDFE',text:'#3C3489'},
  Savings:{bg:'#E8F6EE',text:'#0F6E56'},
  Income:{bg:'#E1F5EE',text:'#085041'},
  Uncat:{bg:'#F2F2EE',text:'#555555'},
};
var CAT_LIST = ['Daily Essentials','House Bills','Travel','Health','Lifestyle','Savings'];
var CAT_COLORS = {'Daily Essentials':'#085041','House Bills':'#0C447C',Travel:'#BA7517',Health:'#D85A30',Lifestyle:'#534AB7',Savings:'#0F6E56'};
var ROLES = ['Earning Member','Homemaker','Student','Child','Elder'];
var CARD_BG = ['#D85A30','#993556','#085041','#534AB7','#534AB7'];
var PROFILE_GENDER_OPTIONS=[
  {label:'Select Gender',value:''},
  {label:'Male',value:'male'},
  {label:'Female',value:'female'},
  {label:'Other',value:'other'},
  {label:'Prefer not to say',value:'prefer_not_to_say'},
];
var PROFILE_CURRENCY_OPTIONS=[
  {label:'₹ INR',value:'INR'},{label:'$ USD',value:'USD'},{label:'€ EUR',value:'EUR'},{label:'£ GBP',value:'GBP'},{label:'AED',value:'AED'},
];
var PROFILE_DATE_FORMAT_OPTIONS=[
  {label:'DD/MM/YYYY',value:'DD/MM/YYYY'},{label:'MM/DD/YYYY',value:'MM/DD/YYYY'},{label:'YYYY-MM-DD',value:'YYYY-MM-DD'},
];
var PROFILE_NUMBER_FORMAT_OPTIONS=[
  {label:'Indian',value:'Indian'},{label:'International',value:'International'},
];
var PROFILE_FIRST_DAY_OPTIONS=[
  {label:'Monday',value:'Monday'},{label:'Sunday',value:'Sunday'},
];
var PROFILE_LANGUAGE_OPTIONS=[
  {label:'English',value:'english'},{label:'हिंदी (Coming Soon)',value:'hindi'},
];
var SHARED_GOAL_CATEGORY_OPTIONS=[
  {label:'Savings',value:'Savings'},{label:'Emergency Fund',value:'Emergency Fund'},{label:'Vacation',value:'Vacation'},{label:'Education',value:'Education'},{label:'Health',value:'Health'},{label:'Other',value:'Other'},
];
var WELLNESS_GOAL_CATEGORY_OPTIONS=[
  {label:'Health',value:'Health'},{label:'Protein',value:'Protein'},{label:'Hydration',value:'Hydration'},{label:'Sleep',value:'Sleep'},{label:'Screen Time',value:'Screen Time'},{label:'Other',value:'Other'},
];

// ─────────────────────────────────────────────────────────────────
// THEME TOKENS — Warm Cream (Light) + Warm Dark
// Matches Claude Design redesign spec.
// ─────────────────────────────────────────────────────────────────
var LIGHT_THEME={
  mode:'light',
  background:'#FAF8F5',
  surface:'#FFFFFF',
  surfaceElevated:'#F3EFE9',
  card:'#FFFFFF',
  text:'#1A1208',
  textSecondary:'#6B5E52',
  muted:'#A89D95',
  primary:'#1C6B50',
  primaryLight:'#E4F2EC',
  primaryOn:'#FFFFFF',
  accent:'#C4773B',
  accentLight:'#FDF0E4',
  border:'#EDE8E2',
  danger:'#C94040',
  warning:'#C4773B',
  success:'#1C6B50',
  overlay:'rgba(0,0,0,0.4)',
  navBarBg:'#FFFFFF',
  navBarShadow:'rgba(28,107,80,0.18)',
  statusBar:'dark-content',
};
var DARK_THEME={
  mode:'dark',
  background:'#1A1612',
  surface:'#221D17',
  surfaceElevated:'#2C261F',
  card:'#221D17',
  text:'#F5EFE6',
  textSecondary:'#B8AC9F',
  muted:'#7A6F65',
  primary:'#3A9778',
  primaryLight:'#1F3B33',
  primaryOn:'#FFFFFF',
  accent:'#E89A5C',
  accentLight:'#3A2A1C',
  border:'#3A3128',
  danger:'#E26B6B',
  warning:'#E89A5C',
  success:'#3A9778',
  overlay:'rgba(0,0,0,0.6)',
  navBarBg:'#221D17',
  navBarShadow:'rgba(0,0,0,0.5)',
  statusBar:'light-content',
};
// Fallback used when ThemeContext isn't mounted (e.g. loading splash).
var COLOR_THEME=LIGHT_THEME;
function getThemeColors(){
  return COLOR_THEME;
}

// ThemeContext — supports 'light' | 'dark' | 'system'
var ThemeContext=createContext({theme:LIGHT_THEME,themeMode:'light',setThemeMode:function(){}});
function ThemeProvider({children}){
  var[themeMode,setThemeMode]=useState('light');
  var[systemScheme,setSystemScheme]=useState('light');
  useEffect(function(){
    try{
      if(Appearance){
        var current=Appearance.getColorScheme&&Appearance.getColorScheme();
        if(current)setSystemScheme(current);
        var sub=Appearance.addChangeListener&&Appearance.addChangeListener(function(p){
          setSystemScheme(p&&p.colorScheme?p.colorScheme:'light');
        });
        return function(){if(sub&&sub.remove)sub.remove();};
      }
    }catch(e){}
  },[]);
  var effectiveMode=themeMode==='system'?systemScheme:themeMode;
  var theme=effectiveMode==='dark'?DARK_THEME:LIGHT_THEME;
  // Keep legacy global in sync so any non-context callers also pick up the right palette
  COLOR_THEME=theme;
  return React.createElement(ThemeContext.Provider,{value:{theme:theme,themeMode:themeMode,setThemeMode:setThemeMode}},children);
}
function useThemeCtx(){return useContext(ThemeContext);}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function fmt(n){return Number(n||0).toLocaleString('en-IN');}
function fmtDecimal(n,digits){return Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:digits||0,maximumFractionDigits:digits||0});}
function toDate(d){return d&&d.toDate?d.toDate():new Date(d||Date.now());}
function isoDate(d){return toDate(d).toISOString().slice(0,10);}
function displayDate(d){return toDate(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}
function isThisMonth(d){var now=new Date(),dt=toDate(d);return dt.getMonth()===now.getMonth()&&dt.getFullYear()===now.getFullYear();}
function isThisWeek(d){return(new Date()-toDate(d))<7*86400000;}
function normMembers(rows){return(rows||[]).map(function(m){
  var accessRole=m.access_role||((m.role==='admin'||m.role==='member')?m.role:'member');
  return{id:m.id,name:m.name,role:m.role,accessRole:accessRole,slot:m.slot,order:m.sort_order,userId:m.user_id,inviteCode:m.invite_code,inviteExpiresAt:m.invite_expires_at,joinedAt:m.joined_at};
});}
function normTransactions(rows){
  var categoryMap={
    Sustenance:'Daily Essentials',
    Home:'House Bills',
    'Travel & Dreams':'Travel',
  };
  return(rows||[]).map(function(t){
    var mapped=categoryMap[t.category]||t.category;
    return Object.assign({},t,{category:mapped,memberName:t.member_name,memberId:t.member_id,is_family_spending:!!t.is_family_spending,recurring_transaction_id:t.recurring_transaction_id||null});
  });
}
function normMeals(rows){return(rows||[]).map(function(m){return Object.assign({},m,{mealTime:m.meal_time,memberName:m.member_name,memberId:m.member_id});});}
function normWellness(rows){return(rows||[]).map(function(w){return Object.assign({},w,{memberName:w.member_name,memberId:w.member_id,screenHrs:w.screen_hrs});});}

var LIMITS={
  finance:{amountMin:0.01,amountMax:1000000,descMax:100},
  meal:{descMax:200,allowedTypes:['breakfast','lunch','dinner']},
  wellness:{waterMin:1,waterMax:20,screenMaxHours:24},
  goals:{nameMax:50},
};

function normalizeText(v){return(v||'').trim();}
function getDisplayName(userRecord,fallbackEmail){
  var directName=normalizeText(userRecord&&userRecord.name);
  if(directName)return directName;
  var recordEmail=normalizeText(userRecord&&userRecord.email);
  if(recordEmail&&recordEmail.includes('@'))return recordEmail.split('@')[0];
  var safeEmail=normalizeText(fallbackEmail);
  if(safeEmail&&safeEmail.includes('@'))return safeEmail.split('@')[0];
  return 'User';
}
function isFutureDate(d){return toDate(d).getTime()>new Date().getTime();}
function isSameLocalDate(a,b){var d1=toDate(a);var d2=toDate(b);return d1.getFullYear()===d2.getFullYear()&&d1.getMonth()===d2.getMonth()&&d1.getDate()===d2.getDate();}
function differenceInDays(a,b){
  var d1=new Date(a);d1.setHours(0,0,0,0);
  var d2=new Date(b);d2.setHours(0,0,0,0);
  return Math.floor((d1.getTime()-d2.getTime())/86400000);
}
function formatDateISO(d){return isoDate(d);}
async function checkForInviteCode(){
  try{
    var initial=await Linking.getInitialURL();
    var src=initial||'';
    var match=src.match(/(?:invite|join)[\/=:?&-]*([A-Z0-9]{6})/i);
    if(match&&match[1])return String(match[1]).toUpperCase();
  }catch(e){console.log('[INVITE LINK PARSE ERROR]',e);}
  return null;
}
function formatINRCurrency(n){
  return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n||0));
}
function glassesToLitres(glasses){return Number((Number(glasses||0)*0.25).toFixed(2));}
function litresToGlasses(litres){return Math.round(Number(litres||0)/0.25);}
function formatWaterFromLitres(litres){
  var safeLitres=Number(litres||0);
  var glasses=litresToGlasses(safeLitres);
  return glasses+' glasses ('+fmtDecimal(safeLitres,2)+'L)';
}
function parseWeightKg(weightValue,weightUnit){
  var w=parseNumericAnswer(weightValue);
  if(w===null||w<=0)return null;
  if(String(weightUnit||'kg').toLowerCase()==='lbs')return Number((w*0.45359237).toFixed(2));
  return Number(w);
}
function calculateProteinTargets(weightKg){
  var w=Number(weightKg||0);
  if(!w||isNaN(w)||w<=0)return{regular:50,active:65};
  return {regular:Math.round(w*1.2),active:Math.round(w*1.5)};
}
function normalizeGenderValue(value){
  var v=String(value||'').trim().toLowerCase();
  if(!v)return '';
  if(v==='male'||v==='m')return 'male';
  if(v==='female'||v==='f')return 'female';
  if(v==='other'||v==='non-binary'||v==='non_binary')return 'other';
  if(v==='prefer_not_to_say'||v==='prefer not to say')return 'prefer_not_to_say';
  return '';
}
function parseProfileDate(value){
  if(!value)return null;
  var d=new Date(value);
  if(isNaN(d.getTime()))return null;
  return d;
}
function startOfDay(d){var dt=toDate(d);dt.setHours(0,0,0,0);return dt;}
function endOfDay(d){var dt=toDate(d);dt.setHours(23,59,59,999);return dt;}
function addDays(d,days){var dt=toDate(d);dt.setDate(dt.getDate()+days);return dt;}
function monthKey(d){var dt=toDate(d);return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function getMemberForUser(members,userId){return(members||[]).find(function(m){return m.userId===userId;})||null;}
function canModifyMemberData(isAdmin,members,userId,memberId){
  if(isAdmin)return true;
  var member=(members||[]).find(function(m){return m.id===memberId;});
  if(!member)return memberId==='joint'||!memberId;
  return member.userId===userId;
}
function isMemberAdmin(member){
  if(!member)return false;
  var roleValue=String(member.accessRole||member.access_role||'').toLowerCase();
  return roleValue==='admin';
}
function getMemberRoleDisplay(member){
  var accessLabel=isMemberAdmin(member)?'Family Admin':'Member';
  var baseRole=normalizeText(member&&member.role)||'Earning Member';
  return accessLabel+' · '+baseRole;
}
function calcDayCompletion(familyId,date,transactions,meals,wellness){
  var iso=isoDate(date);
  var hasTx=(transactions||[]).some(function(t){return t.family_id===familyId && isoDate(t.date)===iso;});
  var dayMeals=(meals||[]).filter(function(m){return m.family_id===familyId && isoDate(m.date)===iso;});
  function mealOf(type){return dayMeals.some(function(m){return String(m.mealTime||m.meal_time||'').toLowerCase()===type;});}
  var hasBreakfast=mealOf('breakfast');
  var hasLunch=mealOf('lunch');
  var hasDinner=mealOf('dinner');
  var dayWell=(wellness||[]).filter(function(w){return w.family_id===familyId && w.date===iso;});
  var hasScreen=dayWell.some(function(w){return (w.screenHrs||0)>0 || (w.screen_hrs||0)>0;});
  var hasMeal=hasBreakfast||hasLunch||hasDinner; // kept for backwards-compat consumers
  var hasWater=dayWell.some(function(w){return (w.water||0)>0;}); // kept for opt-in display
  var completedItems=[hasTx,hasBreakfast,hasLunch,hasDinner,hasScreen];
  var completed=completedItems.filter(Boolean).length;
  return {
    date:iso,
    completed:completed,
    total:5,
    percent:Math.round((completed/5)*100),
    flags:{transaction:hasTx,breakfast:hasBreakfast,lunch:hasLunch,dinner:hasDinner,screen:hasScreen,meal:hasMeal,water:hasWater},
  };
}
function getCompletionColor(percent){
  if(percent>=100)return '#0F6E56';
  if(percent>=50)return '#EF9F27';
  return '#D65A5A';
}

function relativeTime(dateValue){
  var dt=toDate(dateValue);
  var now=new Date();
  var diffMs=now.getTime()-dt.getTime();
  var mins=Math.floor(diffMs/60000);
  if(mins<1)return 'Just now';
  if(mins<60)return mins+' min'+(mins===1?'':'s')+' ago';
  var hrs=Math.floor(mins/60);
  if(hrs<24)return hrs+' hour'+(hrs===1?'':'s')+' ago';
  var days=Math.floor(hrs/24);
  if(days===1)return 'Yesterday';
  if(days<7)return days+' days ago';
  return displayDate(dt);
}

function groupByDateLabel(rows,getDate){
  var now=startOfDay(new Date());
  var y=startOfDay(addDays(now,-1));
  var out={Today:[],Yesterday:[],'This Week':[],Earlier:[]};
  (rows||[]).forEach(function(r){
    var d=startOfDay(getDate(r));
    if(d.getTime()===now.getTime())out.Today.push(r);
    else if(d.getTime()===y.getTime())out.Yesterday.push(r);
    else if((now.getTime()-d.getTime())<=7*86400000)out['This Week'].push(r);
    else out.Earlier.push(r);
  });
  return out;
}

function getNextRecurringDueDate(baseDate,frequency,dueDay){
  var base=startOfDay(baseDate||new Date());
  var due=parseInt(dueDay||'1',10);if(isNaN(due)||due<1||due>31)due=1;
  if(frequency==='weekly')return addDays(base,7);
  if(frequency==='biweekly')return addDays(base,14);
  var candidate=new Date(base.getFullYear(),base.getMonth(),Math.min(due,28));
  if(candidate.getTime()<=base.getTime())candidate=new Date(base.getFullYear(),base.getMonth()+1,Math.min(due,28));
  return candidate;
}

function buildActivityMessage(activity){
  var data=activity&&activity.activity_data?activity.activity_data:{};
  var actor=data.user_name||'Someone';
  if(activity.activity_type==='transaction'){
    if(data.action==='deleted')return actor+' deleted ₹'+fmt(data.amount||0)+' '+(data.category||'transaction');
    if(data.action==='updated')return actor+' updated ₹'+fmt(data.amount||0)+' '+(data.category||'transaction');
    return actor+' added ₹'+fmt(data.amount||0)+' '+(data.category||'transaction')+' '+((data.transaction_type==='income')?'income':'expense');
  }
  if(activity.activity_type==='meal'){
    if(data.action==='deleted')return actor+' deleted a '+(data.meal_time||'meal')+' log';
    if(data.action==='updated')return actor+' updated '+(data.meal_time||'meal')+' log';
    return actor+' logged '+(data.meal_time||'meal');
  }
  if(activity.activity_type==='wellness')return actor+' logged '+(data.log_type==='screen_time'?'screen time':'water');
  if(activity.activity_type==='goal'){
    if(data.action==='created')return actor+' created goal: '+(data.goal_name||'Goal');
    if(data.action==='updated')return actor+' updated goal progress for '+(data.goal_name||'goal');
    if(data.action==='deleted')return actor+' deleted goal: '+(data.goal_name||'Goal');
    return actor+' updated '+(data.goal_name||'a goal');
  }
  if(activity.activity_type==='shared_goal'){
    if(data.action==='created')return actor+' created shared goal: '+(data.goal_name||'Goal');
    if(data.action==='updated')return actor+' updated shared goal: '+(data.goal_name||'Goal');
    return actor+' updated shared goal';
  }
  if(activity.activity_type==='comment')return actor+' commented on '+(data.transaction_name||'a transaction');
  if(activity.activity_type==='shared_goal_contribution')return actor+' contributed ₹'+fmt(data.amount||0)+' to '+(data.goal_name||'a goal');
  if(activity.activity_type==='family')return actor+' joined the family';
  return actor+' has a new update';
}

function friendlyErrorMessage(err){
  var raw=(err&&err.message?String(err.message):String(err||'')).toLowerCase();
  if(!raw)return'Something went wrong. Please try again.';
  if(raw.includes('network request failed')||raw.includes('failed to fetch')||raw.includes('timeout')||raw.includes('timed out'))return'Could not reach the server. Check your internet and try again.';
  if(raw.includes('permission')||raw.includes('row-level security')||raw.includes('not allowed')||raw.includes('unauthorized'))return"You don't have permission for this action. Please sign in again and try.";
  if(raw.includes('duplicate key')||raw.includes('violates'))return'This data could not be saved because of a data conflict. Please review the input and try again.';
  return'Something went wrong while saving. Please try again.';
}

function showFriendlyError(title,err){
  console.log('[APP ERROR]',title,err);
  Alert.alert(title||'Error',friendlyErrorMessage(err));
}

async function uploadPhotoToStorage(bucket,uri,userId,prefix){
  try{
    if(!uri)return null;
    var response=await fetch(uri);
    var blob=await response.blob();
    var inferredExt='jpg';
    var mime=(blob&&blob.type)||'';
    if(mime.indexOf('png')>=0)inferredExt='png';
    else if(mime.indexOf('webp')>=0)inferredExt='webp';
    else if(mime.indexOf('heic')>=0)inferredExt='heic';
    var fileName=(prefix||'photo')+'_'+(userId||'user')+'_'+Date.now()+'.'+inferredExt;
    var upload=await supabase.storage.from(bucket).upload(fileName,blob,{contentType:mime||'image/jpeg',upsert:false});
    if(upload.error)throw upload.error;
    return fileName;
  }catch(e){
    console.log('[PHOTO UPLOAD ERROR]',e);
    return null;
  }
}

// B8: Haptic helper — all calls wrapped in try-catch so Android devices without support fail silently
function haptic(type){
  try{
    if(type==='light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if(type==='medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if(type==='heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    else if(type==='success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if(type==='error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }catch(e){}
}

// B6: Find the Monday of this week (for weekly score reset)
function mondayOfWeek(date){
  var d=new Date(date||Date.now());
  var day=d.getDay();var diff=day===0?-6:1-day; // Sunday-as-7 handling
  d.setDate(d.getDate()+diff);d.setHours(0,0,0,0);
  return d;
}

// B6: Record a score entry — one row per action, per member, per day
async function recordScore(familyId,memberId,actionType,points){
  try{
    var payload={family_id:familyId,member_id:memberId||'joint',date:isoDate(new Date()),action_type:actionType,points_earned:points};
    var{data,error}=await supabase.from('family_scores').insert(payload).select();
    console.log('[SCORE INSERT]',{payload:payload,data:data,error:error});
    if(error)console.log('[SCORE ERROR]',error);
  }catch(e){console.log('[SCORE EXCEPTION]',e);}
}

// B6: Update the streak for a habit. Called whenever a habit action happens.
// Awards streak bonuses at 3-day and 7-day marks.
async function bumpStreak(familyId,memberId,habitType){
  try{
    var today=isoDate(new Date());
    var{data:existing}=await supabase.from('streaks').select('*').eq('family_id',familyId).eq('member_id',memberId||'joint').eq('habit_type',habitType).maybeSingle();
    var newStreak=1;
    if(existing){
      var last=existing.last_logged_date;
      if(last===today){return;} // Already counted today
      var yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);var yISO=isoDate(yesterday);
      newStreak = last===yISO ? (existing.current_streak||0)+1 : 1;
    }
    var upsertPayload={family_id:familyId,member_id:memberId||'joint',habit_type:habitType,current_streak:newStreak,last_logged_date:today,updated_at:new Date().toISOString()};
    var{data,error}=await supabase.from('streaks').upsert(upsertPayload,{onConflict:'family_id,member_id,habit_type'}).select();
    console.log('[STREAK UPSERT]',{payload:upsertPayload,data:data,error:error});
    // Streak bonuses
    if(newStreak===3){await recordScore(familyId,memberId,'streak_3_'+habitType,10);haptic('success');}
    if(newStreak===7){await recordScore(familyId,memberId,'streak_7_'+habitType,25);haptic('success');}
  }catch(e){console.log('[STREAK EXCEPTION]',e);}
}

// B7: Generate a 6-character alphanumeric invite code (excluding ambiguous 0/O/1/I)
function generateInviteCode(){
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s='';
  for(var i=0;i<6;i++)s+=chars.charAt(Math.floor(Math.random()*chars.length));
  return s;
}

// ═══════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════
function useThemeColors(){
  var ctx=useContext(ThemeContext);
  if(ctx&&ctx.theme)return ctx.theme;
  return getThemeColors();
}

function Pill({label}){
  var c=CATS[label]||CATS.Uncat;
  var theme=useThemeColors();
  return<View style={[z.pill,{backgroundColor:c.bg,borderWidth:0.5,borderColor:theme.border}]}><Text style={[z.pillTx,{color:c.text}]}>{label}</Text></View>;
}
function Bar({pct,color,h}){
  var theme=useThemeColors();
  return<View style={[z.pTrk,{height:h||5,backgroundColor:theme.surface,borderWidth:0.5,borderColor:theme.border}]}><View style={[z.pFl,{width:Math.min(pct||0,100)+'%',backgroundColor:color||theme.primary}]}/></View>;
}
function Sec({children}){
  var theme=useThemeColors();
  return<Text style={[z.sec,{color:theme.text}]}>{children}</Text>;
}
function Inp({label,value,onChangeText,secure,placeholder,keyboardType,multiline,maxLength}){
  var theme=useThemeColors();
  return(<View style={{marginBottom:12}}>
    {label?<Text style={[z.inpLabel,{color:theme.textSecondary}]}>{label}</Text>:null}
    <TextInput style={[z.inp,{backgroundColor:theme.surface,color:theme.text,borderColor:theme.border},multiline&&{height:80,textAlignVertical:'top'}]} value={value} onChangeText={onChangeText}
      secureTextEntry={secure} placeholder={placeholder} placeholderTextColor={theme.muted}
      keyboardType={keyboardType||'default'} multiline={multiline} maxLength={maxLength}/>
  </View>);
}

function DateField({label,value,onChange,minimumDate,maximumDate}){
  var[show,setShow]=useState(false);
  var theme=useThemeColors();
  function handleChange(event,selectedDate){
    if(Platform.OS==='android')setShow(false);
    if(selectedDate)onChange(selectedDate);
  }
  return(<View style={{marginBottom:12}}>
    <Text style={[z.inpLabel,{color:theme.textSecondary}]}>{label||'Date'}</Text>
    <TouchableOpacity style={[z.inp,z.dateBtn,{backgroundColor:theme.surface,borderColor:theme.border}]} onPress={function(){setShow(true);}}>
      <Text style={[z.dateBtnTx,{color:theme.text}]}>{displayDate(value)}</Text>
      <Text style={[z.cap,{color:theme.muted}]}>Change</Text>
    </TouchableOpacity>
    {Platform.OS==='web'&&<Text style={[z.cap,{marginTop:6,color:theme.muted}]}>Date picker is not supported on web preview. Use mobile app for calendar picker.</Text>}
    {show&&Platform.OS!=='web'&&<DateTimePicker value={value||new Date()} mode="date" display={Platform.OS==='ios'?'spinner':'default'} minimumDate={minimumDate||undefined} maximumDate={maximumDate||new Date()} onChange={handleChange}/>}
    {show&&Platform.OS==='ios'&&<TouchableOpacity style={[z.bSec,{marginTop:8,borderColor:theme.primary}]} onPress={function(){setShow(false);}}><Text style={[z.bSecT,{color:theme.primary}]}>Done</Text></TouchableOpacity>}
  </View>);
}

function SelectField({label,value,onChange,options,placeholder,disabled}){
  var[open,setOpen]=useState(false);
  var theme=useThemeColors();
  var selected=(options||[]).find(function(opt){return opt.value===value;});
  return <View style={{marginBottom:12}}>
    {label?<Text style={[z.inpLabel,{color:theme.textSecondary}]}>{label}</Text>:null}
    <TouchableOpacity disabled={disabled} style={[z.inp,z.dateBtn,{backgroundColor:theme.surface,borderColor:theme.border},disabled&&{opacity:0.6}]} onPress={function(){if(!disabled)setOpen(true);}}>
      <Text style={[z.dateBtnTx,{color:theme.text},!selected&&{color:theme.muted}]}>{selected?selected.label:(placeholder||'Select')}</Text>
      <Text style={[z.cap,{color:theme.muted}]}>▾</Text>
    </TouchableOpacity>
    {open&&<Modal visible={true} transparent animationType="fade"><View style={[z.modalWrap,{justifyContent:'center',backgroundColor:theme.overlay}]}><View style={[z.modal,{margin:20,maxHeight:420,backgroundColor:theme.card}]}>
      <View style={[z.row,{justifyContent:'space-between',marginBottom:8}]}> 
        <Text style={[z.h1,{color:theme.text}]}>{label||'Select'}</Text>
        <TouchableOpacity onPress={function(){setOpen(false);}}><Text style={[z.bSecT,{color:theme.primary}]}>Close</Text></TouchableOpacity>
      </View>
      <ScrollView>
        {(options||[]).map(function(opt){var sel=opt.value===value;return <TouchableOpacity key={String(opt.value)} style={[z.pickRow,{backgroundColor:theme.surface,borderColor:theme.border},sel&&z.pickRowSel]} onPress={function(){onChange&&onChange(opt.value);setOpen(false);}}>
          <Text style={[z.body,{color:theme.text},sel&&{fontWeight:'600',color:theme.primary}]}>{opt.label}</Text>
          {sel&&<Text style={[z.linkTx,{color:theme.primary}]}>✓</Text>}
        </TouchableOpacity>;})}
      </ScrollView>
    </View></View></Modal>}
  </View>;
}

function DayDetailModal({visible,date,onClose,onChangeDate,onEditTransaction,onEditMeal,onAddTransaction,onAddMeal,onAddWater,onAddScreen,onAddGoal}){
  var{transactions,meals,wellness,goals,sharedGoals,sharedGoalContributions,members,waterTrackingEnabled}=useApp();
  var focusDate=toDate(date||new Date());
  var dayIso=isoDate(focusDate);
  var dayTx=(transactions||[]).filter(function(t){return isoDate(t.date)===dayIso;});
  var incomeTx=dayTx.filter(function(t){return t.category==='Income';});
  var expenseTx=dayTx.filter(function(t){return t.category!=='Income';});
  var dayMeals=(meals||[]).filter(function(m){return isoDate(m.date)===dayIso;});
  var mealsByType={breakfast:[],lunch:[],dinner:[],snack:[]};
  dayMeals.forEach(function(m){var key=String((m.mealTime||'').toLowerCase());if(!mealsByType[key])mealsByType[key]=[];mealsByType[key].push(m);});
  var dayWell=(wellness||[]).filter(function(w){return w.date===dayIso;});
  var dayContribs=(sharedGoalContributions||[]).filter(function(c){return isoDate(c.contributed_at||c.created_at)===dayIso;});
  var hasData=dayTx.length>0||dayMeals.length>0||dayWell.length>0||dayContribs.length>0;
  var header=focusDate.toLocaleDateString('en-IN',{weekday:'long',month:'long',day:'numeric',year:'numeric'});

  function section(title,children){
    return <View style={[z.card,{marginBottom:8}]}> 
      <Text style={[z.txM,{marginBottom:6}]}>{title}</Text>
      {children}
    </View>;
  }

  return <Modal visible={visible} transparent animationType="slide"><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={z.modalWrap}><View style={z.modal}><ScrollView>
    <View style={[z.row,{justifyContent:'space-between',marginBottom:8}]}> 
      <TouchableOpacity onPress={function(){onChangeDate&&onChangeDate(addDays(focusDate,-1));}}><Text style={z.linkTx}>‹ Prev</Text></TouchableOpacity>
      <TouchableOpacity style={z.bSec} onPress={function(){onChangeDate&&onChangeDate(new Date());}}><Text style={z.bSecT}>Today</Text></TouchableOpacity>
      <TouchableOpacity onPress={function(){onChangeDate&&onChangeDate(addDays(focusDate,1));}}><Text style={z.linkTx}>Next ›</Text></TouchableOpacity>
    </View>
    <View style={[z.row,{justifyContent:'space-between',marginBottom:10}]}> 
      <View style={{flex:1,paddingRight:10}}><Text style={z.h1}>This day</Text><Text style={z.cap}>{header}</Text></View>
      <TouchableOpacity onPress={onClose}><Text style={z.bSecT}>Back</Text></TouchableOpacity>
    </View>

    {!hasData&&section('No logs for this day',<View>
      <Text style={[z.cap,{marginBottom:10}]}>No logs for this day.</Text>
      <TouchableOpacity style={z.bPri} onPress={function(){onAddTransaction&&onAddTransaction(focusDate);}}><Text style={z.bPriT}>+ Capture entry</Text></TouchableOpacity>
    </View>)}

    {hasData&&<View>
      {section('Transactions',<View>
        <Text style={z.cap}>Income: {incomeTx.length} · Expense: {expenseTx.length}</Text>
        {incomeTx.concat(expenseTx).slice(0,20).map(function(t){return <TouchableOpacity key={t.id} style={z.pickRow} onPress={function(){if(onEditTransaction)onEditTransaction(t);else Alert.alert('Open Finance','Go to Finance tab to edit this transaction.');}}>
          <View style={{flex:1}}><Text style={z.body}>{t.merchant}</Text><Text style={z.cap}>{t.memberName||'Joint'} · {t.category}</Text></View>
          <Text style={z.fv}>₹{fmt(t.amount||0)}</Text>
        </TouchableOpacity>;})}
        {dayTx.length===0&&<Text style={z.cap}>No entries on this day.</Text>}
      </View>)}

      {section('Meals',<View>
        {['breakfast','lunch','dinner','snack'].map(function(mt){var rows=mealsByType[mt]||[];return <View key={mt} style={{marginBottom:6}}>
          <Text style={[z.cap,{textTransform:'capitalize'}]}>{mt} ({rows.length})</Text>
          {rows.map(function(m){return <TouchableOpacity key={m.id} style={z.pickRow} onPress={function(){onEditMeal&&onEditMeal(m);}}>
            <View style={{flex:1}}><Text style={z.body}>{m.items}</Text><Text style={z.cap}>{m.memberName||'Member'} · Protein {m.protein||0}g</Text></View>
            <Text style={z.linkTx}>Edit</Text>
          </TouchableOpacity>;})}
        </View>;})}
        {dayMeals.length===0&&<Text style={z.cap}>No meals on this day.</Text>}
      </View>)}

      {section('Wellness',<View>
        {/* M10: tap a wellness row to open the appropriate logger for that member+date */}
        {dayWell.map(function(w){return <TouchableOpacity key={w.id||((w.memberId||'m')+'_'+w.date)} activeOpacity={0.7} onPress={function(){haptic('light');if(w.screenHrs||w.screen_hrs){onAddScreen&&onAddScreen(toDate(w.date));}else if((w.water||0)>0){onAddWater&&onAddWater(toDate(w.date));}else{onAddScreen&&onAddScreen(toDate(w.date));}}} style={z.pickRow}><View style={{flex:1}}><Text style={z.body}>{w.memberName||'Member'}</Text><Text style={z.cap}>{waterTrackingEnabled?'Water: '+formatWaterFromLitres(w.water||0)+' \u00b7 ':''}Screen: {w.screenHrs||0}h</Text></View><Text style={z.linkTx}>Edit</Text></TouchableOpacity>;})}
        {dayWell.length===0&&<Text style={z.cap}>No wellness logs.</Text>}
      </View>)}

      {section('Goals Progress',<View>
        {(goals||[]).slice(0,5).map(function(g){var pct=g.target>0?Math.round((g.current/g.target)*100):0;return <View key={g.id} style={[z.row,{justifyContent:'space-between',marginBottom:4}]}><Text style={z.cap}>{g.name}</Text><Text style={z.cap}>{pct}%</Text></View>;})}
        {(sharedGoals||[]).slice(0,3).map(function(g){var pct=g.target_amount>0?Math.round((Number(g.current_amount||0)/Number(g.target_amount))*100):0;return <View key={g.id} style={[z.row,{justifyContent:'space-between',marginBottom:4}]}><Text style={z.cap}>Shared: {g.goal_name}</Text><Text style={z.cap}>{pct}%</Text></View>;})}
        {dayContribs.length>0&&<Text style={z.cap}>Contributions today: {dayContribs.length}</Text>}
        {((goals||[]).length===0&&(sharedGoals||[]).length===0)&&<Text style={z.cap}>No goals available.</Text>}
      </View>)}
    </View>}

    <View style={[z.row,{flexWrap:'wrap',gap:8,marginTop:2}]}> 
      <TouchableOpacity style={[z.bPri,{flex:1,minWidth:120}]} onPress={function(){onAddTransaction&&onAddTransaction(focusDate);}}><Text style={z.bPriT}>+ Transaction</Text></TouchableOpacity>
      <TouchableOpacity style={[z.bSec,{flex:1,minWidth:120}]} onPress={function(){onAddMeal&&onAddMeal(focusDate);}}><Text style={z.bSecT}>+ Meal</Text></TouchableOpacity>
      {waterTrackingEnabled&&<TouchableOpacity style={[z.bSec,{flex:1,minWidth:120}]} onPress={function(){onAddWater&&onAddWater(focusDate);}}><Text style={z.bSecT}>+ Water</Text></TouchableOpacity>}
      <TouchableOpacity style={[z.bSec,{flex:1,minWidth:120}]} onPress={function(){onAddScreen&&onAddScreen(focusDate);}}><Text style={z.bSecT}>+ Screen</Text></TouchableOpacity>
    </View>
  </ScrollView></View></KeyboardAvoidingView></Modal>;
}

function UnifiedCalendarModal({visible,onClose,context,selectedDate,onSelectDate,onOpenDayDetail}){
  var{familyId,transactions,meals,wellness,recurringTransactions}=useApp();
  var[currentMonth,setCurrentMonth]=useState(startOfDay(selectedDate||new Date()));
  var[localSelected,setLocalSelected]=useState(selectedDate||new Date());
  useEffect(function(){if(visible){setCurrentMonth(startOfDay(selectedDate||new Date()));setLocalSelected(selectedDate||new Date());}},[visible,selectedDate]);

  function monthDaysGrid(baseMonth){
    var first=new Date(baseMonth.getFullYear(),baseMonth.getMonth(),1);
    var startWeekDay=(first.getDay()+6)%7;
    var start=addDays(first,-startWeekDay);
    var cells=[];
    for(var i=0;i<42;i++)cells.push(addDays(start,i));
    return cells;
  }

  function cellStats(d){
    var iso=isoDate(d);
    var tx=(transactions||[]).filter(function(t){return isoDate(t.date)===iso;});
    var ml=(meals||[]).filter(function(m){return isoDate(m.date)===iso;});
    var wl=(wellness||[]).filter(function(w){return w.date===iso;});
    var rc=(recurringTransactions||[]).filter(function(r){return isoDate(r.next_due_date)===iso && r.is_active;});
    return {tx:tx.length,meal:ml.length,well:wl.length,recur:rc.length,completion:calcDayCompletion(familyId,d,transactions,meals,wellness)};
  }

  var cells=monthDaysGrid(currentMonth);
  var selectedStats=cellStats(localSelected);
  var selectedISO=isoDate(localSelected);

  function markerColor(stats){
    if(context==='finance')return stats.tx>0||stats.recur>0?'#085041':'#E0E0DB';
    if(context==='wellness')return stats.meal>0||stats.well>0?'#534AB7':'#E0E0DB';
    return getCompletionColor(stats.completion.percent);
  }

  return <Modal visible={visible} transparent animationType="slide"><View style={z.modalWrap}><View style={z.modal}>
    <View style={[z.row,{justifyContent:'space-between',marginBottom:10}]}> 
      <Text style={z.h1}>Calendar</Text>
      <TouchableOpacity onPress={onClose}><Text style={z.bSecT}>Close</Text></TouchableOpacity>
    </View>
    <Text style={[z.cap,{marginBottom:10}]}>Opened from {context==='finance'?'Finance':context==='wellness'?'Wellness':'Insights'}</Text>
    <View style={[z.row,{justifyContent:'space-between',marginBottom:10}]}> 
      <TouchableOpacity onPress={function(){setCurrentMonth(new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1));}}><Text style={z.linkTx}>‹ Prev</Text></TouchableOpacity>
      <Text style={z.txM}>{currentMonth.toLocaleString('en-IN',{month:'long',year:'numeric'})}</Text>
      <TouchableOpacity onPress={function(){setCurrentMonth(new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1));}}><Text style={z.linkTx}>Next ›</Text></TouchableOpacity>
    </View>
    <View style={[z.row,{justifyContent:'space-between',marginBottom:6}]}>{['M','T','W','T','F','S','S'].map(function(d,idx){return<Text key={d+'_'+idx} style={[z.cap,{width:'14%',textAlign:'center'}]}>{d}</Text>;})}</View>
    <View style={{flexDirection:'row',flexWrap:'wrap'}}>
      {cells.map(function(d){
        var inMonth=d.getMonth()===currentMonth.getMonth();
        var stats=cellStats(d);
        var isSel=isoDate(d)===selectedISO;
        return <TouchableOpacity key={isoDate(d)} style={[z.calCell,{backgroundColor:inMonth?'#FFF':'#F2F2EE',borderColor:isSel?'#085041':'transparent'}]} onPress={function(){
          setLocalSelected(d);
          onSelectDate&&onSelectDate(d);
          if(onOpenDayDetail){onClose&&onClose();onOpenDayDetail(d,context);}
        }}>
          <Text style={[z.calCellTx,!inMonth&&{color:'#BBB'}]}>{d.getDate()}</Text>
          <View style={[z.calDot,{backgroundColor:markerColor(stats)}]}/>
        </TouchableOpacity>;
      })}
    </View>
    <View style={[z.card,{marginTop:8}]}> 
      <Text style={z.txM}>{displayDate(localSelected)}</Text>
      <Text style={z.cap}>Transactions: {selectedStats.tx} · Meals: {selectedStats.meal} · Wellness logs: {selectedStats.well}</Text>
      <Text style={z.cap}>Recurring due: {selectedStats.recur} · Completion: {selectedStats.completion.percent}%</Text>
    </View>
  </View></View></Modal>;
}

// B8: Swipe-down to dismiss wrapper for modals. Detects a downward pan of 100px and calls onDismiss.
function SwipeDownDismiss({onDismiss,children}){
  function onEnd(ev){
    var ne=ev.nativeEvent;
    if(ne.state===GHState.END && ne.translationY>100){
      haptic('light');
      onDismiss();
    }
  }
  return(<PanGestureHandler onHandlerStateChange={onEnd} activeOffsetY={10}><View style={{flex:1}}>{children}</View></PanGestureHandler>);
}

// B8: Edge-swipe-back wrapper. Detects a right-swipe starting within 30px of left edge.
function SwipeRightBack({onBack,children}){
  function onEnd(ev){
    var ne=ev.nativeEvent;
    if(ne.state===GHState.END && ne.x<150 && ne.translationX>80 && ne.velocityX>200){
      // Start position came from within 30px of left edge (checked via onBegan location)
      haptic('light');
      onBack();
    }
  }
  return(<PanGestureHandler onHandlerStateChange={onEnd} activeOffsetX={[-10,10]}><View style={{flex:1}}>{children}</View></PanGestureHandler>);
}

// B8: Swipeable transaction card. Right-swipe past 60px fires onConfirm with medium haptic.
// Left-swipe past 60px fires onEdit with light haptic. Card slides with the finger and snaps back on release below threshold.
function SwipeableTxCard({tx,onConfirm,onEdit,children}){
  var translateX=useRef(new Animated.Value(0)).current;
  var committed=useRef(false);
  function onGesture(ev){
    translateX.setValue(ev.nativeEvent.translationX);
  }
  function onStateChange(ev){
    var ne=ev.nativeEvent;
    if(ne.state===GHState.END){
      var dx=ne.translationX;
      if(dx>60 && !committed.current){
        committed.current=true;
        haptic('medium');
        // Slide out to the right then snap back for the next card to appear
        Animated.timing(translateX,{toValue:400,duration:300,useNativeDriver:true}).start(function(){
          onConfirm&&onConfirm();
          translateX.setValue(0);
          committed.current=false;
        });
      } else if(dx<-60 && !committed.current){
        committed.current=true;
        haptic('light');
        Animated.spring(translateX,{toValue:0,useNativeDriver:true}).start(function(){
          onEdit&&onEdit();
          committed.current=false;
        });
      } else {
        // Below threshold: ease back gently
        Animated.timing(translateX,{toValue:0,duration:200,useNativeDriver:true}).start();
      }
    }
  }
  return(<PanGestureHandler onGestureEvent={onGesture} onHandlerStateChange={onStateChange} activeOffsetX={[-10,10]}>
    <Animated.View style={{transform:[{translateX:translateX}]}}>{children}</Animated.View>
  </PanGestureHandler>);
}

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════
function AuthScreen({onWantJoin,initialInviteCode,onAuthSuccess,onAuthRefreshRequested}){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var[isSignup,setIsSignup]=useState(true);
  var[email,setEmail]=useState('');
  var[pass,setPass]=useState('');
  var[loading,setLoading]=useState(false);

  useEffect(function(){
    if(initialInviteCode)onWantJoin&&onWantJoin(initialInviteCode);
  },[initialInviteCode]);

  async function ensurePublicUser(authUserId,emailValue,userType){
    var existingRes=await supabase
      .from('users')
      .select('*')
      .or('auth_user_id.eq.'+authUserId+',id.eq.'+authUserId)
      .maybeSingle();
    if(existingRes.error)throw existingRes.error;
    if(existingRes.data)return existingRes.data;

    var createRes=await supabase
      .from('users')
      .insert({
        [DB_COLUMNS.USERS.ID]:authUserId,
        [DB_COLUMNS.USERS.AUTH_USER_ID]:authUserId,
        [DB_COLUMNS.USERS.USER_TYPE]:userType||'primary',
        [DB_COLUMNS.USERS.NAME]:null,
        [DB_COLUMNS.USERS.EMAIL]:emailValue||null,
        [DB_COLUMNS.USERS.QUESTIONNAIRE_COMPLETED]:false,
      })
      .select()
      .single();
    if(createRes.error)throw createRes.error;
    return createRes.data;
  }

  async function handleSignup(){
    var safeEmail=String(email||'').trim().toLowerCase();
    if(!safeEmail||!pass){Alert.alert('Missing','Enter email and password');return;}
    haptic('light');
    setLoading(true);
    try{
      console.log('[AUTH] Starting signup with:',safeEmail);

      var authRes=await supabase.auth.signUp({email:safeEmail,password:pass});
      if(authRes.error){
        console.log('[AUTH] Signup auth error:',authRes.error);
        Alert.alert('Signup Error',authRes.error.message||'Unable to create account');
        return;
      }

      var authUser=(authRes.data&&authRes.data.user)||null;
      if(!authUser){
        console.log('[AUTH] Signup returned no immediate user. Trying sign in fallback.');
        var signInFallback=await supabase.auth.signInWithPassword({email:safeEmail,password:pass});
        if(signInFallback.error){
          console.log('[AUTH] Signup fallback sign-in error:',signInFallback.error);
          Alert.alert('Signup complete','Account was created. Please log in to continue.');
          onAuthRefreshRequested&&onAuthRefreshRequested();
          return;
        }
        authUser=(signInFallback.data&&signInFallback.data.user)||null;
      }

      if(!authUser||!authUser.id){
        Alert.alert('Error','Could not get user account after signup. Please try login.');
        return;
      }

      console.log('[AUTH] Signup auth successful user id:',authUser.id);

      var userData=await ensurePublicUser(authUser.id,safeEmail,'primary');
      console.log('[AUTH] Signup public.users ready id:',userData&&userData.id);

      onAuthSuccess&&onAuthSuccess({
        sessionUser:authUser,
        userData:userData,
        nextScreen:'questionnaire',
      });

      console.log('[AUTH] Navigating to questionnaire after signup');
    }catch(e){
      console.log('[AUTH] Signup fatal error:',e);
      haptic('error');
      Alert.alert('Error',e.message||'Unable to sign up');
    }finally{
      setLoading(false);
    }
  }

  async function handleLogin(){
    var safeEmail=String(email||'').trim().toLowerCase();
    if(!safeEmail||!pass){Alert.alert('Missing','Enter email and password');return;}
    haptic('light');
    setLoading(true);
    try{
      console.log('[AUTH] Starting login with:',safeEmail);

      var authRes=await supabase.auth.signInWithPassword({email:safeEmail,password:pass});
      if(authRes.error){
        console.log('[AUTH] Login auth error:',authRes.error);
        Alert.alert('Login Error',authRes.error.message||'Unable to login');
        return;
      }

      var authUser=authRes.data&&authRes.data.user;
      if(!authUser||!authUser.id){
        Alert.alert('Error','Login succeeded but user is missing. Please try again.');
        return;
      }

      console.log('[AUTH] Login successful user id:',authUser.id);

      var userFetch=await supabase
        .from('users')
        .select('*')
        .or('auth_user_id.eq.'+authUser.id+',id.eq.'+authUser.id)
        .maybeSingle();

      if(userFetch.error){
        console.log('[AUTH] Login user fetch error:',userFetch.error);
      }

      var userData=userFetch.data;
      if(!userData){
        console.log('[AUTH] User not found in public.users. Creating now.');
        userData=await ensurePublicUser(authUser.id,safeEmail,'primary');
      }

      var nextScreen='main_app';
      if(!userData[DB_COLUMNS.USERS.QUESTIONNAIRE_COMPLETED])nextScreen='questionnaire';
      else if(!userData.family_id)nextScreen=userData.user_type==='member'?'invite_join':'family_setup';

      console.log('[AUTH] Login user loaded:',userData&&userData.id,'next:',nextScreen);

      onAuthSuccess&&onAuthSuccess({
        sessionUser:authUser,
        userData:userData,
        nextScreen:nextScreen,
      });
    }catch(e){
      console.log('[AUTH] Login fatal error:',e);
      haptic('error');
      Alert.alert('Error',e.message||'Unable to login');
    }finally{
      setLoading(false);
    }
  }

  return(
    <View style={{flex:1,backgroundColor:theme.primary}}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary}/>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView contentContainerStyle={{flexGrow:1}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Top — green hero */}
          <View style={{paddingTop:ins.top+24,paddingHorizontal:28,paddingBottom:48}}>
            <Text style={{fontSize:12,fontWeight:'600',color:'rgba(255,255,255,0.65)',letterSpacing:1.4,textTransform:'uppercase',marginBottom:16}}>FamilyOS</Text>
            <Text style={{fontSize:34,fontWeight:'700',color:'#FFFFFF',letterSpacing:-0.8,lineHeight:42}}>{isSignup?"Build your family\u2019s story.":'Welcome back.'}</Text>
            <Text style={{fontSize:15,fontWeight:'400',color:'rgba(255,255,255,0.78)',marginTop:14,lineHeight:22}}>{isSignup?'One shared space for money, meals, and milestones.':'Pick up right where you left off.'}</Text>
          </View>

          {/* Bottom — white card */}
          <View style={{flex:1,backgroundColor:theme.surface,borderTopLeftRadius:28,borderTopRightRadius:28,paddingHorizontal:24,paddingTop:24,paddingBottom:32,minHeight:480}}>
            {/* Toggle pill */}
            <View style={{flexDirection:'row',backgroundColor:theme.surfaceElevated,borderRadius:14,padding:4,marginBottom:24}}>
              <TouchableOpacity style={{flex:1,paddingVertical:11,alignItems:'center',borderRadius:10,backgroundColor:isSignup?theme.surface:'transparent'}} onPress={function(){setIsSignup(true);}}>
                <Text style={{fontSize:14,fontWeight:'600',color:isSignup?theme.primary:theme.textSecondary}}>Sign Up</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{flex:1,paddingVertical:11,alignItems:'center',borderRadius:10,backgroundColor:!isSignup?theme.surface:'transparent'}} onPress={function(){setIsSignup(false);}}>
                <Text style={{fontSize:14,fontWeight:'600',color:!isSignup?theme.primary:theme.textSecondary}}>Log In</Text>
              </TouchableOpacity>
            </View>

            <Text style={{fontSize:12,fontWeight:'600',color:theme.textSecondary,marginBottom:6,letterSpacing:0.2}}>Email</Text>
            <TextInput
              style={{height:52,borderWidth:1,borderColor:theme.border,borderRadius:14,paddingHorizontal:16,fontSize:16,color:theme.text,backgroundColor:theme.surface,marginBottom:16}}
              placeholder="you@email.com"
              placeholderTextColor={theme.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={{fontSize:12,fontWeight:'600',color:theme.textSecondary,marginBottom:6,letterSpacing:0.2}}>Password</Text>
            <TextInput
              style={{height:52,borderWidth:1,borderColor:theme.border,borderRadius:14,paddingHorizontal:16,fontSize:16,color:theme.text,backgroundColor:theme.surface,marginBottom:24}}
              placeholder="Min 6 characters"
              placeholderTextColor={theme.muted}
              value={pass}
              onChangeText={setPass}
              secureTextEntry
            />

            <TouchableOpacity
              style={{backgroundColor:theme.primary,borderRadius:14,paddingVertical:16,alignItems:'center',opacity:loading?0.7:1}}
              onPress={function(){if(isSignup)handleSignup();else handleLogin();}}
              disabled={loading}
            >
              <Text style={{fontSize:15,fontWeight:'600',color:'#FFFFFF',letterSpacing:0.2}}>{loading?'Please wait\u2026':isSignup?'Create Account':'Log In'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={function(){onWantJoin&&onWantJoin();}} style={{marginTop:20,alignItems:'center'}}>
              <Text style={{fontSize:14,fontWeight:'500',color:theme.textSecondary}}>Have an invite code? <Text style={{color:theme.primary,fontWeight:'600'}}>Join family \u2192</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// B7: Join-by-invite-code flow — used by a new member whose admin already invited them.
// Flow: enter code → preview family+member → sign up/log in → link user_id to that member slot.
function InviteJoinScreen({onBack,onJoined,initialCode}){
  var[step,setStep]=useState(1);
  var[code,setCode]=useState(initialCode||'');
  var[loading,setLoading]=useState(false);
  var[preview,setPreview]=useState(null);
  var[email,setEmail]=useState('');
  var[pass,setPass]=useState('');
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();

  useEffect(function(){
    if(initialCode){
      setCode(initialCode);
      lookup(initialCode);
    }
  },[initialCode]);

  async function lookup(forcedCode){
    var codeInput=(forcedCode||code||'').trim().toUpperCase();
    if(!codeInput){Alert.alert('Missing','Enter invite code');return;}
    haptic('light');
    setLoading(true);
    try{
      var inviteRes=await supabase.from('family_invites').select('*').eq('invite_code',codeInput).maybeSingle();
      var invite=inviteRes&&inviteRes.data;
      if(inviteRes.error)throw inviteRes.error;
      if(!invite){Alert.alert('Not found','That invite code is not valid.');setLoading(false);return;}
      if(invite.status==='accepted'||invite.used_by){Alert.alert('Already used','This invite code has already been used.');setLoading(false);return;}
      if(invite.status==='expired'){Alert.alert('Expired','This invite code has expired. Ask family admin for a new one.');setLoading(false);return;}
      var famRes=await supabase.from('families').select('*').eq('id',invite.family_id).maybeSingle();
      var fam=famRes&&famRes.data;
      setPreview({invite:invite,family:fam});
      setCode(codeInput);
      setStep(2);
    }catch(e){haptic('error');showFriendlyError('Could not verify invite code',e);}
    setLoading(false);
  }

  async function joinAndLink(){
    if(!email||!pass){Alert.alert('Missing','Enter email and password');return;}
    if(!preview||!preview.invite){Alert.alert('Invite missing','Please verify invite code again.');return;}
    haptic('light');
    setLoading(true);
    try{
      var authResult=await supabase.auth.signUp({email:email,password:pass});
      if(authResult.error&&String(authResult.error.message||'').toLowerCase().includes('already registered')){
        authResult=await supabase.auth.signInWithPassword({email:email,password:pass});
      }
      if(authResult.error)throw authResult.error;
      var uid=authResult.data&&authResult.data.user&&authResult.data.user.id;
      if(!uid)throw new Error('Could not get user id after signup');

      var userUpsert=await supabase.from('users').upsert({
        [DB_COLUMNS.USERS.ID]:uid,
        [DB_COLUMNS.USERS.AUTH_USER_ID]:uid,
        [DB_COLUMNS.USERS.USER_TYPE]:'member',
        [DB_COLUMNS.USERS.EMAIL]:email,
        [DB_COLUMNS.USERS.NAME]:preview.invite.invited_member_name||((email||'').split('@')[0])||'Member',
        [DB_COLUMNS.USERS.QUESTIONNAIRE_COMPLETED]:false,
        [DB_COLUMNS.USERS.QUESTIONNAIRE_DATA]:{invite_code:code,invited_member_name:preview.invite.invited_member_name||null,invited_member_role:preview.invite.invited_member_role||null},
      }).select().single();
      if(userUpsert.error)throw userUpsert.error;

      await supabase.from('family_members').insert({
        family_id:preview.invite.family_id,
        user_id:uid,
        role:(preview.invite.invited_member_role||'parent').toLowerCase(),
        invited_by:preview.invite.invited_by||null,
      });

      await supabase.from('family_invites').update({status:'accepted',used_by:uid}).eq('id',preview.invite.id);
      haptic('success');
      onJoined&&onJoined({inviteCode:code});
    }catch(e){
      console.log('[INVITE JOIN ERROR]',e);
      haptic('error');
      Alert.alert('Error',e.message||'Unable to join family');
    }
    setLoading(false);
  }

  var codeChars=String(code||'').toUpperCase().padEnd(6,' ').slice(0,6).split('');

  return(
    <View style={[z.scr,{paddingTop:ins.top,backgroundColor:theme.background,flex:1}]}>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView style={z.fl} contentContainerStyle={[z.pad,{paddingTop:24}]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step===1&&<View>
            <TouchableOpacity onPress={onBack} style={{marginBottom:24,alignSelf:'flex-start'}}>
              <Text style={{fontSize:16,fontWeight:'500',color:theme.textSecondary}}>{'\u2190'} Back</Text>
            </TouchableOpacity>

            <Text style={{fontSize:34,fontWeight:'700',color:theme.text,letterSpacing:-0.8,lineHeight:42,marginBottom:8}}>{'Join your\nfamily.'}</Text>
            <Text style={{fontSize:15,fontWeight:'400',color:theme.textSecondary,marginBottom:32,lineHeight:22}}>Enter the 6-character invite code from your family admin.</Text>

            {/* 6-character code boxes */}
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:24}}>
              {codeChars.map(function(ch,i){
                var filled=ch&&ch!==' ';
                return <View key={'cbox_'+i} style={{
                  width:48,height:56,borderRadius:12,
                  borderWidth:filled?2:1,
                  borderColor:filled?theme.primary:theme.border,
                  backgroundColor:filled?theme.primaryLight:theme.surface,
                  alignItems:'center',justifyContent:'center',
                }}>
                  <Text style={{fontSize:22,fontWeight:'700',color:filled?theme.primary:theme.muted}}>{filled?ch:''}</Text>
                </View>;
              })}
            </View>

            <TextInput
              style={{height:52,borderWidth:1,borderColor:theme.border,borderRadius:14,paddingHorizontal:16,fontSize:18,color:theme.text,backgroundColor:theme.surface,letterSpacing:4,textAlign:'center',marginBottom:20,fontWeight:'600'}}
              placeholder="ENTER CODE"
              placeholderTextColor={theme.muted}
              value={code}
              onChangeText={function(v){setCode(String(v||'').toUpperCase().slice(0,6));}}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />

            <TouchableOpacity style={[z.bPri,{backgroundColor:theme.primary,opacity:loading?0.7:1}]} onPress={function(){lookup();}} disabled={loading}>
              <Text style={[z.bPriT,{color:theme.primaryOn}]}>{loading?'Looking up\u2026':'Look Up Code'}</Text>
            </TouchableOpacity>
          </View>}

          {step===2&&preview&&<View>
            <TouchableOpacity onPress={function(){setStep(1);setPreview(null);}} style={{marginBottom:24,alignSelf:'flex-start'}}>
              <Text style={{fontSize:16,fontWeight:'500',color:theme.textSecondary}}>{'\u2190'} Wrong code</Text>
            </TouchableOpacity>

            <Text style={{fontSize:34,fontWeight:'700',color:theme.text,letterSpacing:-0.8,lineHeight:42,marginBottom:8}}>{'Almost\nthere.'}</Text>
            <Text style={{fontSize:15,fontWeight:'400',color:theme.textSecondary,marginBottom:24,lineHeight:22}}>Confirm and create your account to finish joining.</Text>

            {/* Green preview card */}
            <View style={{backgroundColor:theme.primary,borderRadius:20,padding:20,marginBottom:24}}>
              <Text style={{fontSize:11,fontWeight:'600',color:'rgba(255,255,255,0.7)',letterSpacing:1.2,textTransform:'uppercase',marginBottom:8}}>You\u2019re joining</Text>
              <Text style={{fontSize:24,fontWeight:'700',color:'#FFFFFF',letterSpacing:-0.5,marginBottom:14}}>{preview.family&&preview.family.family_name?preview.family.family_name:'Family'}</Text>
              <View style={{height:1,backgroundColor:'rgba(255,255,255,0.18)',marginBottom:14}}/>
              <Text style={{fontSize:13,color:'rgba(255,255,255,0.8)',marginBottom:4}}>Invited as</Text>
              <Text style={{fontSize:17,fontWeight:'600',color:'#FFFFFF'}}>{preview.invite.invited_member_name||'Member'} <Text style={{fontWeight:'400',color:'rgba(255,255,255,0.75)'}}>\u00b7 {preview.invite.invited_member_role||'parent'}</Text></Text>
            </View>

            <Text style={{fontSize:12,fontWeight:'600',color:theme.textSecondary,marginBottom:6}}>Email</Text>
            <TextInput
              style={{height:52,borderWidth:1,borderColor:theme.border,borderRadius:14,paddingHorizontal:16,fontSize:16,color:theme.text,backgroundColor:theme.surface,marginBottom:16}}
              placeholder="you@email.com"
              placeholderTextColor={theme.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={{fontSize:12,fontWeight:'600',color:theme.textSecondary,marginBottom:6}}>Password</Text>
            <TextInput
              style={{height:52,borderWidth:1,borderColor:theme.border,borderRadius:14,paddingHorizontal:16,fontSize:16,color:theme.text,backgroundColor:theme.surface,marginBottom:24}}
              placeholder="Min 6 characters"
              placeholderTextColor={theme.muted}
              value={pass}
              onChangeText={setPass}
              secureTextEntry
            />

            <TouchableOpacity style={{backgroundColor:theme.primary,borderRadius:14,paddingVertical:16,alignItems:'center',opacity:loading?0.7:1}} onPress={joinAndLink} disabled={loading}>
              <Text style={{fontSize:15,fontWeight:'600',color:'#FFFFFF',letterSpacing:0.2}}>{loading?'Joining\u2026':'Join '+(preview.family&&preview.family.family_name?preview.family.family_name:'Family')+' \u2192'}</Text>
            </TouchableOpacity>
          </View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// QUESTIONNAIRE (PHASE 4 FINAL - 38 QUESTIONS)
// ═══════════════════════════════════════════════════════════════
var Q_TOTAL_PAGES=7;
var Q_LOCATION_OPTIONS=['Bengaluru','Hyderabad','Chennai','Mumbai','Delhi','Kolkata','Pune','Ahmedabad','Jaipur','Lucknow','Kanpur','Nagpur','Indore','Bhopal','Patna','Chandigarh','Coimbatore','Visakhapatnam','Mysuru','Vijayawada','Kochi','Surat','Nashik','Varanasi','Other'];
var Q_LANGUAGE_OPTIONS=['English','Hindi','Tamil','Telugu','Kannada','Malayalam','Marathi','Gujarati','Punjabi','Bengali','Odia','Urdu','Other'];
var Q_FAMILY_OPTIONS=['Just me','Partner','Kids','Parents','Extended'];
var Q_PASSION_OPTIONS=['Cooking','Travel','Sports','Reading','Music','Fitness','Spirituality','Gardening','Movies','Art','Technology','Business'];

function createDefaultQuestionnaireAnswers(){
  return {
    q1_name:'',
    q2_dob:null,
    q3_location:'',
    q4_language:'',
    q5_occupation:'',
    q6_family:[],
    q6_children_count:'',
    q7_passions:[],

    q8_spending_awareness:'',
    q9_spending_regret:'',
    q10_savings_investments:'',
    q11_has_loans:'',
    q11_loan_types:[],
    q12_money_stress:5,
    q13_spender_type:'',
    q14_financial_worry:'',
    q15_goal_1year:'',
    q16_goal_5year:'',
    q17_stopping_you:'',

    q18_height:'',
    q18_height_unit:'cm',
    q19_weight:'',
    q19_weight_unit:'kg',
    q20_sleep_hours:7,
    q21_exercise:'',
    q21_exercise_types:[],
    q22_protein_awareness:'',
    q23_water_glasses:8,
    q24_smoking:'',
    q25_alcohol:'',
    q26_health_conditions:'',
    q26_conditions_list:'',
    q27_energy_level:5,

    q28_screen_time:'',
    q29_morning_phone:'',
    q30_social_detox:'',
    q31_mindfulness:'',
    q32_mental_exhaustion:'',
    q33_family_time:3,
    q34_mental_drain:'',

    q35_purpose:'',
    q36_looking_for:'',
    q37_consistency:'',
    q38_legacy:'',
  };
}

function parseNumericAnswer(v){
  var n=parseFloat(String(v||'').replace(/,/g,''));
  return isNaN(n)?null:n;
}

function calculateAgeFromDob(dob){
  if(!dob)return null;
  var birth=toDate(dob);
  if(isNaN(birth.getTime()))return null;
  var today=new Date();
  var age=today.getFullYear()-birth.getFullYear();
  var m=today.getMonth()-birth.getMonth();
  if(m<0 || (m===0 && today.getDate()<birth.getDate()))age--;
  return age<0?null:age;
}

function calculateBMI(heightValue,heightUnit,weightValue,weightUnit){
  var h=parseNumericAnswer(heightValue);
  var w=parseNumericAnswer(weightValue);
  if(h===null||w===null||h<=0||w<=0)return null;
  var cm=heightUnit==='ft'?h*30.48:h;
  var kg=weightUnit==='lbs'?w*0.45359237:w;
  var m=cm/100;
  if(m<=0)return null;
  var bmi=kg/(m*m);
  return Number(bmi.toFixed(2));
}

function TransitionCard({lines}){
  var fade=useRef(new Animated.Value(0)).current;
  useEffect(function(){
    fade.setValue(0);
    Animated.timing(fade,{toValue:1,duration:220,useNativeDriver:true}).start();
  },[JSON.stringify(lines)]);
  return <Animated.View style={[z.qTransitionCard,{opacity:fade}]}> 
    {(lines||[]).map(function(line,idx){return <Text key={'line_'+idx} style={z.qTransitionLine}>{line}</Text>;})}
  </Animated.View>;
}

function ProgressIndicator({page,total}){
  var theme=useThemeColors();
  var pct=Math.round((page/total)*100);
  return <View style={{marginBottom:14}}>
    <View style={[z.row,{justifyContent:'space-between',marginBottom:8}]}> 
      <Text style={[z.cap,{color:theme.muted,letterSpacing:0.6,textTransform:'uppercase',fontWeight:'600'}]}>Page {page} of {total}</Text>
      <Text style={[z.cap,{color:theme.primary,fontWeight:'700'}]}>{pct}%</Text>
    </View>
    <View style={[z.row,{gap:4}]}> 
      {Array.from({length:total}).map(function(_,idx){
        var done=idx<page;
        return <View key={'qdot_'+(idx+1)} style={{flex:1,height:4,borderRadius:2,backgroundColor:done?theme.primary:theme.border}}/>;
      })}
    </View>
  </View>;
}

function QuestionText({children}){return <Text style={z.qQuestionText}>{children}</Text>;}

function ChipSelector({options,value,onChange,multi}){
  var selected=multi?(Array.isArray(value)?value:[]):(value||'');
  return <View style={[z.row,{flexWrap:'wrap',gap:8}]}> 
    {(options||[]).map(function(opt,idx){
      var label=typeof opt==='string'?opt:opt.label;
      var val=typeof opt==='string'?opt:opt.value;
      var isSel=multi?selected.includes(val):(selected===val);
      return <TouchableOpacity key={'chip_'+String(val)+'_'+idx} style={[z.chip,isSel&&z.chipSel]} onPress={function(){
        if(multi){
          var next=isSel?selected.filter(function(v){return v!==val;}):selected.concat([val]);
          onChange&&onChange(next);
        }else{onChange&&onChange(val);}
      }}><Text style={[z.chipTx,isSel&&z.chipSelTx]}>{label}</Text></TouchableOpacity>;
    })}
  </View>;
}

function SliderInput({label,value,onChange,min,max,leftLabel,rightLabel}){
  var numbers=[];
  for(var i=min;i<=max;i++)numbers.push(i);
  return <View style={{marginBottom:14}}>
    <Text style={z.inpLabel}>{label}</Text>
    <Text style={z.qSliderValue}>{value}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingBottom:6}}>
      <View style={[z.row,{gap:6}]}> 
        {numbers.map(function(n){var sel=n===value;return <TouchableOpacity key={'slider_'+label+'_'+n} style={[z.qSliderChip,sel&&z.qSliderChipSel]} onPress={function(){onChange&&onChange(n);}}><Text style={[z.qSliderChipTx,sel&&z.qSliderChipTxSel]}>{n}</Text></TouchableOpacity>;})}
      </View>
    </ScrollView>
    <View style={[z.row,{justifyContent:'space-between',marginTop:4}]}>
      <Text style={z.cap}>{leftLabel||min}</Text>
      <Text style={z.cap}>{rightLabel||max}</Text>
    </View>
  </View>;
}

function ConditionalInput({show,children}){return show?<View style={{marginTop:10}}>{children}</View>:null;}

function NavigationButtons({canGoBack,canContinue,onBack,onContinue,isLast,saving}){
  var theme=useThemeColors();
  return <View style={[z.row,{marginTop:14,gap:10}]}> 
    <TouchableOpacity style={[z.bSec,{flex:1,opacity:canGoBack?1:0.4,borderColor:theme.primary}]} disabled={!canGoBack||saving} onPress={onBack}><Text style={[z.bSecT,{color:theme.primary}]}>Back</Text></TouchableOpacity>
    <TouchableOpacity style={[z.bPri,{flex:1,backgroundColor:canContinue?theme.primary:theme.border,opacity:canContinue?1:0.7}]} disabled={!canContinue||saving} onPress={onContinue}><Text style={[z.bPriT,{color:canContinue?theme.primaryOn:theme.muted}]}>{saving?'Saving\u2026':(isLast?'Finish':'Continue')}</Text></TouchableOpacity>
  </View>;
}

function QuestionnaireScreen({userId,onComplete,isModal,onSkipped}){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var[qPage,setQPage]=useState(1);
  var[qAnswers,setQAnswers]=useState(createDefaultQuestionnaireAnswers());
  var[qErrors,setQErrors]=useState({});
  var[loading,setLoading]=useState(true);
  var[saving,setSaving]=useState(false);
  var[hasSavedProgress,setHasSavedProgress]=useState(false);
  var[showResumePrompt,setShowResumePrompt]=useState(false);

  function setAnswer(key,val){
    setQAnswers(function(prev){var next=Object.assign({},prev);next[key]=val;return next;});
    if(qErrors[key])setQErrors(function(prev){var next=Object.assign({},prev);delete next[key];return next;});
  }

  async function loadSavedProgress(){
    setLoading(true);
    try{
      var defaults=createDefaultQuestionnaireAnswers();
      var{data:progress}=await supabase.from('questionnaire_progress').select('*').eq('user_id',userId).maybeSingle();
      var questionnairePrefillColumns=[
        DB_COLUMNS.USERS.NAME,
        DB_COLUMNS.USERS.EMAIL,
        DB_COLUMNS.USERS.PHONE,
        DB_COLUMNS.USERS.DOB,
        DB_COLUMNS.USERS.GENDER,
        DB_COLUMNS.USERS.HEIGHT,
        DB_COLUMNS.USERS.WEIGHT,
        DB_COLUMNS.USERS.LOCATION,
        DB_COLUMNS.USERS.OCCUPATION,
        DB_COLUMNS.USERS.LANGUAGE,
        DB_COLUMNS.USERS.QUESTIONNAIRE_DATA,
      ].join(',');
      var{data:userDoc}=await supabase.from('users').select(questionnairePrefillColumns).eq('id',userId).maybeSingle();
      var merged=Object.assign({},defaults,userDoc&&userDoc[DB_COLUMNS.USERS.QUESTIONNAIRE_DATA]?userDoc[DB_COLUMNS.USERS.QUESTIONNAIRE_DATA]:{},progress&&progress.answers?progress.answers:{});
      if(userDoc){
        if(!merged.q1_name&&userDoc[DB_COLUMNS.USERS.NAME])merged.q1_name=userDoc[DB_COLUMNS.USERS.NAME];
        if(!merged.q2_dob&&userDoc[DB_COLUMNS.USERS.DOB])merged.q2_dob=userDoc[DB_COLUMNS.USERS.DOB];
        if(!merged.q3_location&&userDoc[DB_COLUMNS.USERS.LOCATION])merged.q3_location=userDoc[DB_COLUMNS.USERS.LOCATION];
        if(!merged.q4_language&&userDoc[DB_COLUMNS.USERS.LANGUAGE])merged.q4_language=userDoc[DB_COLUMNS.USERS.LANGUAGE];
        if(!merged.q5_occupation&&userDoc[DB_COLUMNS.USERS.OCCUPATION])merged.q5_occupation=userDoc[DB_COLUMNS.USERS.OCCUPATION];
        if(!merged.q18_height&&userDoc[DB_COLUMNS.USERS.HEIGHT])merged.q18_height=String(userDoc[DB_COLUMNS.USERS.HEIGHT]);
        if(!merged.q19_weight&&userDoc[DB_COLUMNS.USERS.WEIGHT])merged.q19_weight=String(userDoc[DB_COLUMNS.USERS.WEIGHT]);
      }
      setQAnswers(merged);
      if(progress&&progress.answers){
        setHasSavedProgress(true);
        var resumePage=Number(progress.current_page||((typeof progress.current_screen==='number')?progress.current_screen+1:1))||1;
        resumePage=clamp(resumePage,1,Q_TOTAL_PAGES);
        setQPage(resumePage);
        if(resumePage>1)setShowResumePrompt(true);
      }
    }catch(e){console.log('[QUESTIONNAIRE LOAD ERROR]',e);}finally{setLoading(false);}
  }

  useEffect(function(){loadSavedProgress();},[userId]);

  function validatePage(page,answers){
    var errs={};
    function reqText(key,msg){if(!normalizeText(answers[key]))errs[key]=msg||'This field is required.';}
    function reqPick(key,msg){if(!answers[key])errs[key]=msg||'Please select an option.';}
    function reqMulti(key,msg){if(!Array.isArray(answers[key])||answers[key].length===0)errs[key]=msg||'Please select at least one option.';}
    function reqNumber(key,min,max,msg){
      var n=parseNumericAnswer(answers[key]);
      if(n===null)errs[key]=msg||'Please enter a valid number.';
      else if(min!==undefined && n<min)errs[key]='Minimum allowed is '+min+'.';
      else if(max!==undefined && n>max)errs[key]='Maximum allowed is '+max+'.';
    }

    if(page===1){
      reqText('q1_name');
      if(!answers.q2_dob)errs.q2_dob='Date of birth is required.';
      reqPick('q3_location');
      reqPick('q4_language');
      reqText('q5_occupation');
      reqMulti('q6_family');
      if((answers.q6_family||[]).includes('Kids'))reqNumber('q6_children_count',1,10,'Please enter number of children (1-10).');
      reqMulti('q7_passions');
    }
    if(page===2){
      reqPick('q8_spending_awareness');
      reqText('q9_spending_regret');
      reqPick('q10_savings_investments');
      reqPick('q11_has_loans');
      if(answers.q11_has_loans==='Yes')reqMulti('q11_loan_types');
      if(typeof answers.q12_money_stress!=='number')errs.q12_money_stress='Please select stress score.';
    }
    if(page===3){
      reqPick('q13_spender_type');
      reqPick('q14_financial_worry');
      reqText('q15_goal_1year');
      reqText('q16_goal_5year');
      // q17 optional
    }
    if(page===4){
      reqNumber('q18_height',50,260,'Please enter valid height.');
      reqNumber('q19_weight',20,300,'Please enter valid weight.');
      if(typeof answers.q20_sleep_hours!=='number')errs.q20_sleep_hours='Please set sleep hours.';
      reqPick('q21_exercise');
      if(answers.q21_exercise==='Yes')reqMulti('q21_exercise_types');
      reqPick('q22_protein_awareness');
    }
    if(page===5){
      if(typeof answers.q23_water_glasses!=='number')errs.q23_water_glasses='Please set water target.';
      reqPick('q24_smoking');
      reqPick('q25_alcohol');
      reqPick('q26_health_conditions');
      if(answers.q26_health_conditions==='Yes')reqText('q26_conditions_list');
      if(typeof answers.q27_energy_level!=='number')errs.q27_energy_level='Please set your energy level.';
    }
    if(page===6){
      reqPick('q28_screen_time');
      reqPick('q29_morning_phone');
      reqPick('q30_social_detox');
      reqPick('q31_mindfulness');
      reqPick('q32_mental_exhaustion');
      if(typeof answers.q33_family_time!=='number')errs.q33_family_time='Please select family time.';
      reqPick('q34_mental_drain');
    }
    if(page===7){
      reqText('q35_purpose');
      reqPick('q36_looking_for');
      reqPick('q37_consistency');
      reqText('q38_legacy');
    }
    return errs;
  }

  function isPageValid(page,answers){return Object.keys(validatePage(page,answers)).length===0;}

  async function savePageProgress(nextPage){
    try{
      await supabase.from('questionnaire_progress').upsert({
        user_id:userId,
        current_page:nextPage,
        current_screen:nextPage-1,
        answers:qAnswers,
        is_completed:false,
        updated_at:new Date().toISOString(),
      });
      await supabase.from('users').upsert({id:userId,questionnaire_data:qAnswers,questionnaire_last_step:nextPage,questionnaire_pending:true});
    }catch(e){console.log('[QUESTIONNAIRE SAVE PAGE ERROR]',e);}
  }

  async function finalizeQuestionnaire(){
    var questionnaireAnswers={
      name:normalizeText(qAnswers.q1_name)||null,
      email:normalizeText(qAnswers.q1_email||'')||null,
      phone:normalizeText(qAnswers.q1_phone||'')||null,
      dateOfBirth:qAnswers.q2_dob?isoDate(qAnswers.q2_dob):null,
      gender:normalizeText(qAnswers.q3_gender||'')||null,
      height:qAnswers.q18_height?Number(qAnswers.q18_height):null,
      weight:qAnswers.q19_weight?Number(qAnswers.q19_weight):null,
      location:normalizeText(qAnswers.q3_location)||null,
      occupation:normalizeText(qAnswers.q5_occupation)||null,
      language:normalizeText(qAnswers.q4_language)||null,
    };

    var submitPayload={
      name:questionnaireAnswers.name,
      email:questionnaireAnswers.email,
      phone:questionnaireAnswers.phone,
      [DB_COLUMNS.USERS.DOB]:questionnaireAnswers.dateOfBirth,
      [DB_COLUMNS.USERS.GENDER]:questionnaireAnswers.gender,
      [DB_COLUMNS.USERS.HEIGHT]:questionnaireAnswers.height,
      [DB_COLUMNS.USERS.WEIGHT]:questionnaireAnswers.weight,
      [DB_COLUMNS.USERS.LOCATION]:questionnaireAnswers.location,
      [DB_COLUMNS.USERS.OCCUPATION]:questionnaireAnswers.occupation,
      [DB_COLUMNS.USERS.LANGUAGE]:questionnaireAnswers.language,
      [DB_COLUMNS.USERS.QUESTIONNAIRE_COMPLETED]:true,
      [DB_COLUMNS.USERS.QUESTIONNAIRE_DATA]:qAnswers,
      [DB_COLUMNS.USERS.QUESTIONNAIRE_PENDING]:false,
      [DB_COLUMNS.USERS.QUESTIONNAIRE_LAST_STEP]:Q_TOTAL_PAGES,
      last_active_at:new Date().toISOString(),
    };

    var updateRes=await supabase.from('users').update(submitPayload).eq('id',userId);
    if(updateRes.error){
      console.error('[QUESTIONNAIRE USER UPDATE ERROR]',updateRes.error);
      throw updateRes.error;
    }

    var updatedUserRes=await supabase.from('users').select('*').eq('id',userId).single();
    if(updatedUserRes.error){
      console.error('[QUESTIONNAIRE USER RELOAD ERROR]',updatedUserRes.error);
      throw updatedUserRes.error;
    }

    console.log('[QUESTIONNAIRE] Stored answers in users.questionnaire_data for user:', userId);

    var updatedUser=updatedUserRes.data||{};
    var nextScreen=updatedUser.user_type==='primary'?'family_setup':'main_app';
    onComplete&&onComplete(nextScreen,updatedUser);

    await supabase.from('questionnaire_progress').delete().eq('user_id',userId);
  }

  async function handleContinue(){
    var errs=validatePage(qPage,qAnswers);
    setQErrors(errs);
    if(Object.keys(errs).length>0)return;
    setSaving(true);
    try{
      if(qPage<Q_TOTAL_PAGES){
        var next=qPage+1;
        await savePageProgress(next);
        setQPage(next);
      }else{
        await finalizeQuestionnaire();
      }
    }catch(e){showFriendlyError('Could not save questionnaire',e);}finally{setSaving(false);}
  }

  async function handleBack(){
    if(qPage<=1)return;
    var prev=qPage-1;
    setQPage(prev);
    await savePageProgress(prev);
  }

  async function restartQuestionnaire(){
    var defaults=createDefaultQuestionnaireAnswers();
    setQAnswers(defaults);
    setQErrors({});
    setQPage(1);
    setShowResumePrompt(false);
    try{await supabase.from('questionnaire_progress').delete().eq('user_id',userId);}catch(e){console.log('[QUESTIONNAIRE RESTART ERROR]',e);}
  }


  function renderPageQuestions(){
    if(qPage===1){return <View>
      <QuestionText>1. What is your name?</QuestionText>
      <Inp value={qAnswers.q1_name} onChangeText={function(v){setAnswer('q1_name',v);}} placeholder="First name is fine"/>
      {qErrors.q1_name?<Text style={z.errTx}>{qErrors.q1_name}</Text>:null}

      <QuestionText>2. Date of birth</QuestionText>
      <DateField value={qAnswers.q2_dob||new Date()} onChange={function(d){setAnswer('q2_dob',d);}} maximumDate={new Date()}/>
      {qErrors.q2_dob?<Text style={z.errTx}>{qErrors.q2_dob}</Text>:null}

      <QuestionText>3. Where do you live?</QuestionText>
      <SelectField value={qAnswers.q3_location} onChange={function(v){setAnswer('q3_location',v);}} options={[{label:'Select city',value:''}].concat(Q_LOCATION_OPTIONS.map(function(c){return{label:c,value:c};}))} placeholder="Select city"/>
      {qErrors.q3_location?<Text style={z.errTx}>{qErrors.q3_location}</Text>:null}

      <QuestionText>4. Home language</QuestionText>
      <SelectField value={qAnswers.q4_language} onChange={function(v){setAnswer('q4_language',v);}} options={[{label:'Select language',value:''}].concat(Q_LANGUAGE_OPTIONS.map(function(l){return{label:l,value:l};}))} placeholder="Select language"/>
      {qErrors.q4_language?<Text style={z.errTx}>{qErrors.q4_language}</Text>:null}

      <QuestionText>5. What do you do for a living?</QuestionText>
      <Inp value={qAnswers.q5_occupation} onChangeText={function(v){setAnswer('q5_occupation',v);}} placeholder="Your occupation"/>
      {qErrors.q5_occupation?<Text style={z.errTx}>{qErrors.q5_occupation}</Text>:null}

      <QuestionText>6. Who do you have in your family?</QuestionText>
      <ChipSelector options={Q_FAMILY_OPTIONS} value={qAnswers.q6_family} onChange={function(v){setAnswer('q6_family',v);}} multi={true}/>
      {qErrors.q6_family?<Text style={z.errTx}>{qErrors.q6_family}</Text>:null}
      <ConditionalInput show={(qAnswers.q6_family||[]).includes('Kids')}>
        <Inp label="How many children?" value={String(qAnswers.q6_children_count||'')} onChangeText={function(v){setAnswer('q6_children_count',v.replace(/[^0-9]/g,''));}} keyboardType="numeric" placeholder="1-10"/>
        {qErrors.q6_children_count?<Text style={z.errTx}>{qErrors.q6_children_count}</Text>:null}
      </ConditionalInput>

      <QuestionText>7. What are your passions?</QuestionText>
      <ChipSelector options={Q_PASSION_OPTIONS} value={qAnswers.q7_passions} onChange={function(v){setAnswer('q7_passions',v);}} multi={true}/>
      {qErrors.q7_passions?<Text style={z.errTx}>{qErrors.q7_passions}</Text>:null}
    </View>;}

    if(qPage===2){return <View>
      <QuestionText>8. Spending awareness</QuestionText>
      <ChipSelector options={['I track everything','Rough idea','Not really','No clue']} value={qAnswers.q8_spending_awareness} onChange={function(v){setAnswer('q8_spending_awareness',v);}}/>
      {qErrors.q8_spending_awareness?<Text style={z.errTx}>{qErrors.q8_spending_awareness}</Text>:null}

      <QuestionText>9. Purchase regret from last month</QuestionText>
      <Inp value={qAnswers.q9_spending_regret} onChangeText={function(v){setAnswer('q9_spending_regret',v);}} multiline={true} placeholder="e.g. food delivery, impulse shopping"/>
      {qErrors.q9_spending_regret?<Text style={z.errTx}>{qErrors.q9_spending_regret}</Text>:null}

      <QuestionText>10. Do you have savings or investments for your future?</QuestionText>
      <ChipSelector options={['Yes','No']} value={qAnswers.q10_savings_investments} onChange={function(v){setAnswer('q10_savings_investments',v);}}/>
      {qErrors.q10_savings_investments?<Text style={z.errTx}>{qErrors.q10_savings_investments}</Text>:null}

      <QuestionText>11. Do you have loans?</QuestionText>
      <ChipSelector options={['Yes','No']} value={qAnswers.q11_has_loans} onChange={function(v){setAnswer('q11_has_loans',v);if(v!=='Yes')setAnswer('q11_loan_types',[]);}}/>
      {qErrors.q11_has_loans?<Text style={z.errTx}>{qErrors.q11_has_loans}</Text>:null}
      <ConditionalInput show={qAnswers.q11_has_loans==='Yes'}>
        <ChipSelector options={['Home','Car','Personal','Credit card','Education','Other']} value={qAnswers.q11_loan_types} onChange={function(v){setAnswer('q11_loan_types',v);}} multi={true}/>
        {qErrors.q11_loan_types?<Text style={z.errTx}>{qErrors.q11_loan_types}</Text>:null}
      </ConditionalInput>

      <SliderInput label="12. Money stress (1-10)" value={qAnswers.q12_money_stress} onChange={function(v){setAnswer('q12_money_stress',v);}} min={1} max={10} leftLabel="Low" rightLabel="High"/>
      {qErrors.q12_money_stress?<Text style={z.errTx}>{qErrors.q12_money_stress}</Text>:null}
    </View>;}

    if(qPage===3){return <View>
      <QuestionText>13. How would you describe your spender type?</QuestionText>
      <ChipSelector options={['Planned spender','Balanced spender','Impulse spender','Avoids tracking']} value={qAnswers.q13_spender_type} onChange={function(v){setAnswer('q13_spender_type',v);}}/>
      {qErrors.q13_spender_type?<Text style={z.errTx}>{qErrors.q13_spender_type}</Text>:null}

      <QuestionText>14. Biggest financial worry right now</QuestionText>
      <ChipSelector options={['Debt / EMI','Monthly expenses','Emergency fund','Child education','Retirement','Job security']} value={qAnswers.q14_financial_worry} onChange={function(v){setAnswer('q14_financial_worry',v);}}/>
      {qErrors.q14_financial_worry?<Text style={z.errTx}>{qErrors.q14_financial_worry}</Text>:null}

      <QuestionText>15. Your main goal in 1 year</QuestionText>
      <Inp value={qAnswers.q15_goal_1year} onChangeText={function(v){setAnswer('q15_goal_1year',v);}} placeholder="e.g. emergency fund"/>
      {qErrors.q15_goal_1year?<Text style={z.errTx}>{qErrors.q15_goal_1year}</Text>:null}

      <QuestionText>16. Your main goal in 5 years</QuestionText>
      <Inp value={qAnswers.q16_goal_5year} onChangeText={function(v){setAnswer('q16_goal_5year',v);}} placeholder="e.g. home down payment"/>
      {qErrors.q16_goal_5year?<Text style={z.errTx}>{qErrors.q16_goal_5year}</Text>:null}

      <QuestionText>17. What's stopping you from achieving the goal? (optional)</QuestionText>
      <Inp value={qAnswers.q17_stopping_you} onChangeText={function(v){setAnswer('q17_stopping_you',v);}} multiline={true} placeholder="Optional"/>
    </View>;}

    if(qPage===4){return <View>
      <QuestionText>18. Height</QuestionText>
      <View style={[z.row,{gap:8,marginBottom:8}]}> 
        <TouchableOpacity style={[z.chip,qAnswers.q18_height_unit==='cm'&&z.chipSel]} onPress={function(){setAnswer('q18_height_unit','cm');}}><Text style={[z.chipTx,qAnswers.q18_height_unit==='cm'&&z.chipSelTx]}>cm</Text></TouchableOpacity>
        <TouchableOpacity style={[z.chip,qAnswers.q18_height_unit==='ft'&&z.chipSel]} onPress={function(){setAnswer('q18_height_unit','ft');}}><Text style={[z.chipTx,qAnswers.q18_height_unit==='ft'&&z.chipSelTx]}>ft</Text></TouchableOpacity>
      </View>
      <Inp value={String(qAnswers.q18_height||'')} onChangeText={function(v){setAnswer('q18_height',v.replace(/[^0-9.]/g,''));}} keyboardType="numeric" placeholder={qAnswers.q18_height_unit==='cm'?'e.g. 170':'e.g. 5.7'}/>
      {qErrors.q18_height?<Text style={z.errTx}>{qErrors.q18_height}</Text>:null}

      <QuestionText>19. Weight</QuestionText>
      <View style={[z.row,{gap:8,marginBottom:8}]}> 
        <TouchableOpacity style={[z.chip,qAnswers.q19_weight_unit==='kg'&&z.chipSel]} onPress={function(){setAnswer('q19_weight_unit','kg');}}><Text style={[z.chipTx,qAnswers.q19_weight_unit==='kg'&&z.chipSelTx]}>kg</Text></TouchableOpacity>
        <TouchableOpacity style={[z.chip,qAnswers.q19_weight_unit==='lbs'&&z.chipSel]} onPress={function(){setAnswer('q19_weight_unit','lbs');}}><Text style={[z.chipTx,qAnswers.q19_weight_unit==='lbs'&&z.chipSelTx]}>lbs</Text></TouchableOpacity>
      </View>
      <Inp value={String(qAnswers.q19_weight||'')} onChangeText={function(v){setAnswer('q19_weight',v.replace(/[^0-9.]/g,''));}} keyboardType="numeric" placeholder={qAnswers.q19_weight_unit==='kg'?'e.g. 70':'e.g. 154'}/>
      {qErrors.q19_weight?<Text style={z.errTx}>{qErrors.q19_weight}</Text>:null}

      <SliderInput label="20. Sleep hours" value={qAnswers.q20_sleep_hours} onChange={function(v){setAnswer('q20_sleep_hours',v);}} min={1} max={12} leftLabel="1h" rightLabel="12h"/>
      <QuestionText>21. Do you exercise?</QuestionText>
      <ChipSelector options={['Yes','No']} value={qAnswers.q21_exercise} onChange={function(v){setAnswer('q21_exercise',v);if(v!=='Yes')setAnswer('q21_exercise_types',[]);}}/>
      {qErrors.q21_exercise?<Text style={z.errTx}>{qErrors.q21_exercise}</Text>:null}
      <ConditionalInput show={qAnswers.q21_exercise==='Yes'}>
        <ChipSelector options={['Walking','Gym','Yoga','Sports','Running','Home workout','Other']} value={qAnswers.q21_exercise_types} onChange={function(v){setAnswer('q21_exercise_types',v);}} multi={true}/>
        {qErrors.q21_exercise_types?<Text style={z.errTx}>{qErrors.q21_exercise_types}</Text>:null}
      </ConditionalInput>

      <QuestionText>22. Protein awareness</QuestionText>
      <ChipSelector options={['Yes track',"Know don't track",'No idea']} value={qAnswers.q22_protein_awareness} onChange={function(v){setAnswer('q22_protein_awareness',v);}}/>
      {qErrors.q22_protein_awareness?<Text style={z.errTx}>{qErrors.q22_protein_awareness}</Text>:null}
    </View>;}

    if(qPage===5){return <View>
      <SliderInput label="23. Water glasses per day" value={qAnswers.q23_water_glasses} onChange={function(v){setAnswer('q23_water_glasses',v);}} min={1} max={20} leftLabel="1" rightLabel="20"/>
      <QuestionText>24. Smoking</QuestionText>
      <ChipSelector options={['Never','Occasionally','Regularly','Trying to quit']} value={qAnswers.q24_smoking} onChange={function(v){setAnswer('q24_smoking',v);}}/>
      {qErrors.q24_smoking?<Text style={z.errTx}>{qErrors.q24_smoking}</Text>:null}

      <QuestionText>25. Alcohol</QuestionText>
      <ChipSelector options={['Never','Socially','Regularly','Trying to reduce']} value={qAnswers.q25_alcohol} onChange={function(v){setAnswer('q25_alcohol',v);}}/>
      {qErrors.q25_alcohol?<Text style={z.errTx}>{qErrors.q25_alcohol}</Text>:null}

      <QuestionText>26. Any health conditions?</QuestionText>
      <ChipSelector options={['Yes','No']} value={qAnswers.q26_health_conditions} onChange={function(v){setAnswer('q26_health_conditions',v);if(v!=='Yes')setAnswer('q26_conditions_list','');}}/>
      {qErrors.q26_health_conditions?<Text style={z.errTx}>{qErrors.q26_health_conditions}</Text>:null}
      <ConditionalInput show={qAnswers.q26_health_conditions==='Yes'}>
        <Inp value={qAnswers.q26_conditions_list} onChangeText={function(v){setAnswer('q26_conditions_list',v);}} multiline={true} placeholder="List conditions"/>
        {qErrors.q26_conditions_list?<Text style={z.errTx}>{qErrors.q26_conditions_list}</Text>:null}
      </ConditionalInput>

      <SliderInput label="27. Energy level (1-10)" value={qAnswers.q27_energy_level} onChange={function(v){setAnswer('q27_energy_level',v);}} min={1} max={10} leftLabel="Low" rightLabel="High"/>
    </View>;}

    if(qPage===6){return <View>
      <QuestionText>28. Screen time yesterday</QuestionText>
      <ChipSelector options={['<2h','2-4h','4-6h','6-8h','8+h']} value={qAnswers.q28_screen_time} onChange={function(v){setAnswer('q28_screen_time',v);}}/>
      <Text style={[z.cap,{marginTop:4,marginBottom:8}]}>Not sure? Check Settings → Screen Time.</Text>
      {qErrors.q28_screen_time?<Text style={z.errTx}>{qErrors.q28_screen_time}</Text>:null}

      <QuestionText>29. Do you check phone first thing in the morning?</QuestionText>
      <ChipSelector options={['Yes','No']} value={qAnswers.q29_morning_phone} onChange={function(v){setAnswer('q29_morning_phone',v);}}/>
      {qErrors.q29_morning_phone?<Text style={z.errTx}>{qErrors.q29_morning_phone}</Text>:null}

      <QuestionText>30. Social media detox history</QuestionText>
      <ChipSelector options={['Yes successfully','Yes failed','Never tried',"What's that?"]} value={qAnswers.q30_social_detox} onChange={function(v){setAnswer('q30_social_detox',v);}}/>
      {qErrors.q30_social_detox?<Text style={z.errTx}>{qErrors.q30_social_detox}</Text>:null}

      <QuestionText>31. Do you practice mindfulness?</QuestionText>
      <ChipSelector options={['Yes','No']} value={qAnswers.q31_mindfulness} onChange={function(v){setAnswer('q31_mindfulness',v);}}/>
      {qErrors.q31_mindfulness?<Text style={z.errTx}>{qErrors.q31_mindfulness}</Text>:null}

      <QuestionText>32. Mental exhaustion frequency</QuestionText>
      <ChipSelector options={['Daily','Few times week','Rarely','Never']} value={qAnswers.q32_mental_exhaustion} onChange={function(v){setAnswer('q32_mental_exhaustion',v);}}/>
      {qErrors.q32_mental_exhaustion?<Text style={z.errTx}>{qErrors.q32_mental_exhaustion}</Text>:null}

      <SliderInput label="33. Family time per day (hours)" value={qAnswers.q33_family_time} onChange={function(v){setAnswer('q33_family_time',v);}} min={0} max={10} leftLabel="0h" rightLabel="10h"/>

      <QuestionText>34. Biggest source of mental drain</QuestionText>
      <ChipSelector options={['Work','Money','Health','Relationships','Social media','Sleep','Other']} value={qAnswers.q34_mental_drain} onChange={function(v){setAnswer('q34_mental_drain',v);}}/>
      {qErrors.q34_mental_drain?<Text style={z.errTx}>{qErrors.q34_mental_drain}</Text>:null}
    </View>;}

    return <View>
      <QuestionText>35. Why are you here?</QuestionText>
      <Inp value={qAnswers.q35_purpose} onChangeText={function(v){setAnswer('q35_purpose',v);}} multiline={true} placeholder="Share your reason"/>
      {qErrors.q35_purpose?<Text style={z.errTx}>{qErrors.q35_purpose}</Text>:null}

      <QuestionText>36. What are you looking for?</QuestionText>
      <ChipSelector options={['Long-term lifestyle','Quick results']} value={qAnswers.q36_looking_for} onChange={function(v){setAnswer('q36_looking_for',v);}}/>
      <Text style={[z.cap,{marginTop:4,marginBottom:8}]}>Both answers are allowed. We use this to personalize AI nudges.</Text>
      {qErrors.q36_looking_for?<Text style={z.errTx}>{qErrors.q36_looking_for}</Text>:null}

      <QuestionText>37. Consistency commitment</QuestionText>
      <ChipSelector options={["Yes I'll try","Not sure","Probably not"]} value={qAnswers.q37_consistency} onChange={function(v){setAnswer('q37_consistency',v);}}/>
      {qErrors.q37_consistency?<Text style={z.errTx}>{qErrors.q37_consistency}</Text>:null}

      <QuestionText>38. What legacy do you want to leave after 20 years?</QuestionText>
      <Inp value={qAnswers.q38_legacy} onChangeText={function(v){setAnswer('q38_legacy',v);}} multiline={true} placeholder="Your long-term vision"/>
      {qErrors.q38_legacy?<Text style={z.errTx}>{qErrors.q38_legacy}</Text>:null}
    </View>;
  }

  function renderTransition(){
    if(qPage===1)return <TransitionCard lines={["Before we begin, let's get to know you."]}/>;
    if(qPage===2)return <TransitionCard lines={["Now, let's talk about money.","Not to judge. Just to understand."]}/>;
    if(qPage===4)return <TransitionCard lines={["Money is important. But so is your health.","Let's check in on your body."]}/>;
    if(qPage===6)return <TransitionCard lines={["Your body needs energy. So does your mind.","Let's be honest about screen time."]}/>;
    if(qPage===7)return <TransitionCard lines={["One last thing.","This app isn't a quick fix. It's a lifestyle.","Are you ready?"]}/>;
    return null;
  }

  if(loading){return <View style={[z.qScr,z.cen,{backgroundColor:theme.background}]}><ActivityIndicator size="large" color={theme.primary}/></View>;}

  if(showResumePrompt&&hasSavedProgress){
    return <View style={[z.qScr,{paddingTop:ins.top,backgroundColor:theme.background}]}> 
      <View style={z.qPad}>
        <Text style={[z.h1,{color:theme.text,fontSize:30,letterSpacing:-0.6}]}>Resume questionnaire</Text>
        <Text style={[z.body,{marginBottom:20,color:theme.textSecondary,lineHeight:22}]}>We found your saved progress at page {qPage}. Do you want to continue where you left off?</Text>
        <TouchableOpacity style={[z.bPri,{marginBottom:10,backgroundColor:theme.primary}]} onPress={function(){setShowResumePrompt(false);}}><Text style={z.bPriT}>Continue where I left off</Text></TouchableOpacity>
        <TouchableOpacity style={[z.bSec,{borderColor:theme.primary}]} onPress={restartQuestionnaire}><Text style={[z.bSecT,{color:theme.primary}]}>Start from beginning</Text></TouchableOpacity>
      </View>
    </View>;
  }

  var canContinue=isPageValid(qPage,qAnswers);
  var canExit=qPage>1||(isModal&&typeof onSkipped==='function');
  function onHeaderBack(){
    if(saving)return;
    if(qPage>1){handleBack();return;}
    // page 1 — exit only if modal-skip is allowed; otherwise no-op
    if(isModal&&typeof onSkipped==='function'){onSkipped();}
  }
  return(<View style={[z.qScr,{paddingTop:ins.top,backgroundColor:theme.background}]}> 
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={z.fl}>
      <View style={[z.qStickyProgWrap,{backgroundColor:theme.background,borderBottomColor:theme.border,paddingTop:ins.top+14}]}>
        <View style={[z.row,{justifyContent:'space-between',alignItems:'center',marginBottom:10}]}>
          <TouchableOpacity
            onPress={onHeaderBack}
            disabled={!canExit||saving}
            accessibilityRole="button"
            accessibilityLabel={qPage>1?'Go back':'Close questionnaire'}
            style={{
              width:40,height:40,borderRadius:20,
              borderWidth:1,
              borderColor:canExit?theme.border:'transparent',
              backgroundColor:canExit?theme.surface:'transparent',
              alignItems:'center',justifyContent:'center',
              opacity:canExit?1:0,
            }}
          >
            <Text style={{fontSize:18,color:theme.text,fontWeight:'600',marginTop:-1}}>{qPage>1?'\u2190':'\u2715'}</Text>
          </TouchableOpacity>
          {isModal&&typeof onSkipped==='function'&&qPage>1?(
            <TouchableOpacity onPress={function(){if(!saving)onSkipped();}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Text style={{fontSize:13,fontWeight:'600',color:theme.textSecondary,letterSpacing:0.3}}>Skip for now</Text>
            </TouchableOpacity>
          ):<View style={{width:40,height:40}}/>}
        </View>
        <ProgressIndicator page={qPage} total={Q_TOTAL_PAGES}/>
      </View>
      <ScrollView style={z.fl} contentContainerStyle={[z.qPad,{paddingTop:160}]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {renderTransition()}
        {renderPageQuestions()}
        <NavigationButtons canGoBack={qPage>1} canContinue={canContinue} onBack={handleBack} onContinue={handleContinue} isLast={qPage===Q_TOTAL_PAGES} saving={saving}/>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>);
}

// ═══════════════════════════════════════════════════════════════
// FAMILY SETUP
// ═══════════════════════════════════════════════════════════════
function FamilySetupScreen({userId,currentUserName,onDone}){
  var selfName=normalizeText(currentUserName);
  function newMember(name,role){return{localId:'local_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),name:name||'',role:role||'parent'};}
  var[familyName,setFamilyName]=useState('');
  var[members,setMembers]=useState([newMember('', 'parent')]);
  var[loading,setLoading]=useState(false);
  var[createdFamilyId,setCreatedFamilyId]=useState(null);
  var[createdInvites,setCreatedInvites]=useState([]);
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();

  function addM(){if(members.length<8)setMembers(members.concat([newMember('','parent')]));}
  function upd(i,f,v){var m=members.slice();m[i][f]=v;setMembers(m);}
  function rm(i){setMembers(members.filter(function(_,x){return x!==i;}));}

  async function create(){
    var cleanFamilyName=normalizeText(familyName);
    if(!cleanFamilyName){Alert.alert('Missing details','Enter a family name.');return;}
    setLoading(true);
    try{
      var userRes=await supabase.from('users').select('id,name,email').eq('id',userId).maybeSingle();
      var baseUser=userRes&&userRes.data;
      var ownerName=normalizeText(selfName)||normalizeText(baseUser&&baseUser.name)||normalizeText((baseUser&&baseUser.email||'').split('@')[0])||'Family Admin';

      var userEnsure=await supabase.from('users').upsert({
        id:userId,
        auth_user_id:userId,
        user_type:'primary',
        name:ownerName,
      }).select().single();
      if(userEnsure.error)throw userEnsure.error;

      var famRes=await supabase.from('families').insert({family_name:cleanFamilyName,created_by:userId}).select().single();
      if(famRes.error)throw famRes.error;
      var fam=famRes.data;

      var adminInsert=await supabase.from('family_members').insert({
        family_id:fam.id,
        user_id:userId,
        role:'admin',
      });
      if(adminInsert.error)throw adminInsert.error;

      var updateUser=await supabase.from('users').update({family_id:fam.id}).eq('id',userId);
      if(updateUser.error)throw updateUser.error;

      var drafts=(members||[]).map(function(m){
        return{name:normalizeText(m.name),role:normalizeText(m.role||'parent').toLowerCase()};
      }).filter(function(m){return m.name;});

      var inviteRows=[];
      for(var i=0;i<drafts.length;i++){
        var generated=generateInviteCode();
        var inviteInsert=await supabase.from('family_invites').insert({
          family_id:fam.id,
          invited_by:userId,
          invite_code:generated,
          invited_member_name:drafts[i].name,
          invited_member_role:drafts[i].role,
          status:'pending',
        }).select().single();
        if(inviteInsert.error)throw inviteInsert.error;
        inviteRows.push(inviteInsert.data);
      }

      setCreatedFamilyId(fam.id);
      setCreatedInvites(inviteRows);
    }catch(e){showFriendlyError('Could not create family',e);}
    setLoading(false);
  }

  function copyInviteText(invite){
    var text='Join '+(familyName||'our family')+' with invite code: '+invite.invite_code;
    Share.share({message:text}).catch(function(e){console.log('[INVITE SHARE ERROR]',e);});
  }

  return(
    <View style={[z.scr,{paddingTop:ins.top,backgroundColor:theme.background,flex:1}]}>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView style={z.fl} contentContainerStyle={[z.pad,{paddingTop:24}]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {!createdFamilyId&&<View>
            <Text style={{fontSize:34,fontWeight:'700',color:theme.text,letterSpacing:-0.8,lineHeight:42,marginBottom:8}}>{'Set up your\n'}<Text style={{color:theme.primary}}>family.</Text></Text>
            <Text style={{fontSize:15,fontWeight:'400',color:theme.textSecondary,marginBottom:28,lineHeight:22}}>Pick a family name. You can invite members now or later from Settings.</Text>

            <Text style={{fontSize:12,fontWeight:'600',color:theme.textSecondary,marginBottom:6,letterSpacing:0.2}}>FAMILY NAME</Text>
            <View style={{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:theme.border,borderRadius:14,backgroundColor:theme.surface,paddingHorizontal:16,marginBottom:24}}>
              <TextInput
                style={{flex:1,height:52,fontSize:18,fontWeight:'600',color:theme.text}}
                placeholder="The Sharma Family"
                placeholderTextColor={theme.muted}
                value={familyName}
                onChangeText={setFamilyName}
              />
              <Text style={{fontSize:18,color:theme.muted}}>{'\u270E'}</Text>
            </View>

            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <Text style={{fontSize:13,fontWeight:'700',color:theme.textSecondary,letterSpacing:0.4,textTransform:'uppercase'}}>Members</Text>
              <Text style={{fontSize:12,color:theme.muted}}>Optional</Text>
            </View>

            {(members||[]).map(function(m,i){
              var initial=(m.name||'').trim().charAt(0).toUpperCase()||'?';
              var slot=SLOTS[i%5];
              return <View key={m.localId||('member_'+i)} style={{backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:16,padding:14,marginBottom:10}}>
                <View style={{flexDirection:'row',alignItems:'center',marginBottom:10}}>
                  <View style={{width:42,height:42,borderRadius:21,backgroundColor:slot.bg,alignItems:'center',justifyContent:'center',marginRight:12}}>
                    <Text style={{fontSize:16,fontWeight:'700',color:slot.text}}>{initial}</Text>
                  </View>
                  <Text style={{flex:1,fontSize:13,fontWeight:'600',color:theme.textSecondary}}>Member {i+1}</Text>
                  <TouchableOpacity onPress={function(){rm(i);}}>
                    <Text style={{fontSize:13,fontWeight:'600',color:theme.danger}}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={{height:44,borderWidth:1,borderColor:theme.border,borderRadius:10,paddingHorizontal:12,fontSize:15,color:theme.text,backgroundColor:theme.surface,marginBottom:10}}
                  placeholder="Name"
                  placeholderTextColor={theme.muted}
                  value={m.name}
                  onChangeText={function(v){upd(i,'name',v);}}
                />
                <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
                  {[{label:'Parent',value:'parent'},{label:'Child',value:'child'},{label:'Other',value:'other'}].map(function(opt){
                    var sel=m.role===opt.value;
                    return <TouchableOpacity key={'role_'+i+'_'+opt.value} style={[z.chip,sel&&z.chipSel]} onPress={function(){upd(i,'role',opt.value);}}>
                      <Text style={[z.chipTx,sel&&z.chipSelTx]}>{opt.label}</Text>
                    </TouchableOpacity>;
                  })}
                </View>
              </View>;
            })}

            <TouchableOpacity style={{flexDirection:'row',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:theme.border,borderStyle:'dashed',borderRadius:14,paddingVertical:14,marginBottom:24,backgroundColor:'transparent'}} onPress={addM}>
              <Text style={{fontSize:14,fontWeight:'600',color:theme.primary}}>+ Add Member</Text>
            </TouchableOpacity>

            {(members||[]).filter(function(m){return (m.name||'').trim();}).length>0&&<View style={{marginBottom:24}}>
              <Text style={{fontSize:12,fontWeight:'600',color:theme.textSecondary,marginBottom:10,letterSpacing:0.2}}>PREVIEW</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                {(members||[]).filter(function(m){return (m.name||'').trim();}).map(function(m,i){
                  var slot=SLOTS[i%5];
                  return <View key={'prev_'+i} style={{width:48,height:48,borderRadius:12,backgroundColor:slot.bg,alignItems:'center',justifyContent:'center'}}>
                    <Text style={{fontSize:18,fontWeight:'700',color:slot.text}}>{(m.name||'').trim().charAt(0).toUpperCase()}</Text>
                  </View>;
                })}
              </View>
            </View>}

            <TouchableOpacity style={{backgroundColor:theme.primary,borderRadius:14,paddingVertical:16,alignItems:'center',opacity:loading?0.7:1}} onPress={create} disabled={loading}>
              <Text style={{fontSize:15,fontWeight:'600',color:'#FFFFFF',letterSpacing:0.2}}>{loading?'Creating\u2026':'Create Family \u2192'}</Text>
            </TouchableOpacity>
          </View>}

          {createdFamilyId&&<View>
            <Text style={{fontSize:34,fontWeight:'700',color:theme.text,letterSpacing:-0.8,lineHeight:42,marginBottom:8}}>{'Family\n'}<Text style={{color:theme.primary}}>created.</Text></Text>
            <Text style={{fontSize:15,fontWeight:'400',color:theme.textSecondary,marginBottom:24,lineHeight:22}}>Share these invite codes with your family members.</Text>

            {createdInvites.length===0&&<View style={{backgroundColor:theme.accentLight,borderLeftWidth:3,borderLeftColor:theme.accent,borderRadius:12,padding:14,marginBottom:20}}>
              <Text style={{fontSize:14,color:theme.text,lineHeight:20}}>No invite codes yet. You can add and invite members later from Settings.</Text>
            </View>}
            {createdInvites.map(function(inv){
              return <View key={inv.id} style={{backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:16,padding:16,marginBottom:10}}>
                <Text style={{fontSize:14,fontWeight:'600',color:theme.text,marginBottom:2}}>{inv.invited_member_name||'Member'}</Text>
                <Text style={{fontSize:12,color:theme.textSecondary,marginBottom:12}}>{inv.invited_member_role||'parent'}</Text>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                  <Text style={{fontSize:22,fontWeight:'700',color:theme.primary,letterSpacing:3}}>{inv.invite_code}</Text>
                  <TouchableOpacity onPress={function(){copyInviteText(inv);}} style={{backgroundColor:theme.primaryLight,borderRadius:10,paddingVertical:8,paddingHorizontal:14}}>
                    <Text style={{fontSize:13,fontWeight:'600',color:theme.primary}}>Share \u2192</Text>
                  </TouchableOpacity>
                </View>
              </View>;
            })}
            <TouchableOpacity style={{backgroundColor:theme.primary,borderRadius:14,paddingVertical:16,alignItems:'center',marginTop:16}} onPress={function(){onDone&&onDone(createdFamilyId,normalizeText(familyName)||'My Family',createdInvites);}}>
              <Text style={{fontSize:15,fontWeight:'600',color:'#FFFFFF',letterSpacing:0.2}}>Continue to Home \u2192</Text>
            </TouchableOpacity>
          </View>}
          <View style={{height:40}}/>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════
function AddTxModal({visible,onClose,editTx,initialDate}){
  var{familyId,members,userId,isAdmin,refreshTransactions,upsertTransactionLocal,refreshRecurringTransactions,logActivity,currentUserName}=useApp();
  var[merchant,setMerchant]=useState('');var[amount,setAmount]=useState('');var[cat,setCat]=useState('');var[mid,setMid]=useState('');var[isIncome,setIsIncome]=useState(false);var[loading,setLoading]=useState(false);var[selectedDate,setSelectedDate]=useState(new Date());
  var[isRecurring,setIsRecurring]=useState(false);var[recurringFreq,setRecurringFreq]=useState('monthly');var[dueDay,setDueDay]=useState('1');var[isFamilySpending,setIsFamilySpending]=useState(false);var[photoUri,setPhotoUri]=useState('');
  useEffect(function(){
    if(visible){
      if(editTx){
        setMerchant(editTx.merchant||'');
        setAmount(String(editTx.amount||''));
        setCat(editTx.category==='Income'?'':(editTx.category||''));
        setMid(editTx.memberId&&editTx.memberId!=='joint'?editTx.memberId:'');
        setIsIncome(editTx.category==='Income');
        setSelectedDate(toDate(editTx.date));
        setIsFamilySpending(!!editTx.is_family_spending);
        setPhotoUri(editTx.photo_url||editTx.photo_path||'');
      } else {
        setMerchant('');setAmount('');setCat('');setMid('');setIsIncome(false);setSelectedDate(initialDate?toDate(initialDate):new Date());setIsFamilySpending(false);setPhotoUri('');
      }
      setIsRecurring(false);setRecurringFreq('monthly');setDueDay(String(new Date().getDate()));
    }
  },[visible,editTx,initialDate]);

  useEffect(function(){
    (async function(){
      try{
        await ImagePicker.requestCameraPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }catch(e){console.log('[TX PHOTO PERMISSION ERROR]',e);}
    })();
  },[]);

  var categoryOptions=CAT_LIST.slice();
  var categoryPickerOptions=[{label:'Select Category',value:''}].concat(categoryOptions.map(function(c){return{label:c,value:c};}));

  async function pickImage(){
    Alert.alert('Add Photo','Choose source',[
      {text:'Take Photo',onPress:async function(){
        try{
          var cam=await ImagePicker.requestCameraPermissionsAsync();
          if(cam.status!=='granted'){Alert.alert('Permission needed','Camera permission is required to take photos.');return;}
          var result=await ImagePicker.launchCameraAsync({allowsEditing:true,quality:0.7});
          if(!result.canceled&&result.assets&&result.assets[0]&&result.assets[0].uri)setPhotoUri(result.assets[0].uri);
        }catch(e){showFriendlyError('Could not open camera',e);}
      }},
      {text:'Choose from Gallery',onPress:async function(){
        try{
          var lib=await ImagePicker.requestMediaLibraryPermissionsAsync();
          if(lib.status!=='granted'){Alert.alert('Permission needed','Photo library permission is required to choose photos.');return;}
          var result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,quality:0.7});
          if(!result.canceled&&result.assets&&result.assets[0]&&result.assets[0].uri)setPhotoUri(result.assets[0].uri);
        }catch(e){showFriendlyError('Could not open gallery',e);}
      }},
      {text:'Cancel',style:'cancel'},
    ]);
  }

  async function save(){
    var cleanDesc=normalizeText(merchant);
    var amountNum=parseFloat(amount);
    var selectedCategory=isIncome?'Income':cat;
    if(editTx&&!canModifyMemberData(isAdmin,members,userId,editTx.memberId)){Alert.alert('Not allowed','You can only edit your own entries.');return;}
    if(!cleanDesc){Alert.alert('Validation error','Description is required.');return;}
    if(cleanDesc.length>LIMITS.finance.descMax){Alert.alert('Validation error','Description must be '+LIMITS.finance.descMax+' characters or less.');return;}
    if(isNaN(amountNum)||amountNum<LIMITS.finance.amountMin){Alert.alert('Validation error','Amount must be a positive number.');return;}
    if(amountNum>LIMITS.finance.amountMax){Alert.alert('Validation error','Amount cannot exceed '+formatINRCurrency(LIMITS.finance.amountMax)+'.');return;}
    if(!selectedCategory||(!isIncome&&categoryOptions.indexOf(selectedCategory)===-1)){Alert.alert('Validation error','Please choose a valid category.');return;}
    if(isFutureDate(selectedDate)){Alert.alert('Validation error','Date cannot be in the future.');return;}

    setLoading(true);
    try{
      var mN=members.find(function(m){return m.id===mid;});
      var uploadedPhotoPath=photoUri;
      if(photoUri&&photoUri.indexOf('http')!==0){
        uploadedPhotoPath=await uploadPhotoToStorage('transaction-photos',photoUri,userId,'tx');
      }
      var payload={family_id:familyId,merchant:cleanDesc,amount:amountNum,category:selectedCategory,member_id:mid||'joint',member_name:mN?mN.name:'Joint',confirmed:true,source:'Manual',date:isoDate(selectedDate),is_family_spending:isFamilySpending,recurring_transaction_id:null,photo_path:uploadedPhotoPath||null};
      var savedRow;
      if(editTx){
        payload.confirmed=false;
        var updateQuery=supabase.from('transactions').update(payload).eq('id',editTx.id).select().single();
        var updateRes=await updateQuery;
        if(updateRes.error&&String(updateRes.error.message||'').toLowerCase().includes('photo_path')){
          var fallbackPayload=Object.assign({},payload);delete fallbackPayload.photo_path;
          updateRes=await supabase.from('transactions').update(fallbackPayload).eq('id',editTx.id).select().single();
        }
        if(updateRes.error)throw updateRes.error;
        savedRow=updateRes.data;
        upsertTransactionLocal(normTransactions([updateRes.data])[0]);
        haptic('light');
      } else {
        var insertRes=await supabase.from('transactions').insert(payload).select().single();
        if(insertRes.error&&String(insertRes.error.message||'').toLowerCase().includes('photo_path')){
          var fallbackInsert=Object.assign({},payload);delete fallbackInsert.photo_path;
          insertRes=await supabase.from('transactions').insert(fallbackInsert).select().single();
        }
        if(insertRes.error)throw insertRes.error;
        savedRow=insertRes.data;
        upsertTransactionLocal(normTransactions([insertRes.data])[0]);
        if(!isIncome){await recordScore(familyId,payload.member_id,'manual_tx',5);}
        haptic('medium');
      }

      if(isRecurring){
        var due=parseInt(dueDay||'1',10);if(isNaN(due)||due<1||due>31)due=1;
        var nextDue=getNextRecurringDueDate(selectedDate,recurringFreq,due);
        var recurringPayload={
          user_id:userId,
          family_id:familyId,
          transaction_type:isIncome?'income':'expense',
          description:cleanDesc,
          category:selectedCategory,
          amount:amountNum,
          frequency:recurringFreq,
          due_day:due,
          last_logged_date:isoDate(selectedDate),
          next_due_date:isoDate(nextDue),
          is_active:true,
          updated_at:new Date().toISOString(),
        };
        var recRes=await supabase.from('recurring_transactions').insert(recurringPayload).select().single();
        if(recRes.error)throw recRes.error;
      }

      await refreshTransactions();
      if(isRecurring&&refreshRecurringTransactions)await refreshRecurringTransactions();
      if(logActivity){
        await logActivity('transaction',{
          user_name:currentUserName||'Someone',
          action:editTx?'updated':'created',
          amount:amountNum,
          category:selectedCategory,
          merchant:cleanDesc,
          transaction_type:isIncome?'income':'expense',
        },savedRow&&savedRow.id,familyId);
      }
      setMerchant('');setAmount('');setCat('');setMid('');setIsIncome(false);setSelectedDate(initialDate?toDate(initialDate):new Date());setIsRecurring(false);setIsFamilySpending(false);setPhotoUri('');onClose();
    }catch(e){console.log('[TX SAVE ERROR]',e);showFriendlyError(editTx?'Could not update transaction':'Could not save transaction',e);} 
    setLoading(false);
  }
  return(<Modal visible={visible} animationType="slide" transparent><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={z.modalWrap}><SwipeDownDismiss onDismiss={onClose}><View style={z.modal}><ScrollView showsVerticalScrollIndicator={false}>
    <Text style={z.h1}>{editTx?'Edit entry':'Capture an entry'}</Text>
    <View style={[z.row,{gap:8,marginBottom:16}]}><TouchableOpacity style={[z.chip,!isIncome&&z.chipSel]} onPress={function(){setIsIncome(false);}}><Text style={[z.chipTx,!isIncome&&z.chipSelTx]}>Expense</Text></TouchableOpacity><TouchableOpacity style={[z.chip,isIncome&&z.chipSel]} onPress={function(){setIsIncome(true);}}><Text style={[z.chipTx,isIncome&&z.chipSelTx]}>Income</Text></TouchableOpacity></View>
    <Inp label={isIncome?'Income Source':'Description'} value={merchant} onChangeText={setMerchant} placeholder={isIncome?'Salary, freelance, rent...':'Swiggy, DMart...'} maxLength={LIMITS.finance.descMax}/>
    <Inp label="Amount" value={amount} onChangeText={setAmount} placeholder="340" keyboardType="numeric"/>
    {!isIncome&&<SelectField label="Category" value={cat} onChange={setCat} options={categoryPickerOptions} placeholder="Select category"/>}
    <Text style={z.inpLabel}>Who?</Text><View style={[z.row,{flexWrap:'wrap',gap:8,marginBottom:16}]}><TouchableOpacity style={[z.chip,!mid&&z.chipSel]} onPress={function(){setMid('');}}><Text style={[z.chipTx,!mid&&z.chipSelTx]}>Joint</Text></TouchableOpacity>{members.map(function(m){return<TouchableOpacity key={m.id} style={[z.chip,mid===m.id&&z.chipSel]} onPress={function(){setMid(m.id);}}><Text style={[z.chipTx,mid===m.id&&z.chipSelTx]}>{m.name}</Text></TouchableOpacity>;})}</View>
    <DateField label="Date" value={selectedDate} onChange={setSelectedDate} maximumDate={new Date()}/>
    {!isIncome&&<View style={[z.row,{justifyContent:'space-between',marginBottom:10}]}> 
      <Text style={z.body}>Family Spending?</Text>
      <Switch value={isFamilySpending} onValueChange={setIsFamilySpending}/>
    </View>}
    <TouchableOpacity style={[z.bSec,{marginBottom:10,alignSelf:'flex-start'}]} onPress={pickImage}><Text style={z.bSecT}>📷 Add Photo</Text></TouchableOpacity>
    {photoUri?<Image source={{uri:photoUri}} style={z.photoPreview}/>:null}
    <TouchableOpacity style={[z.row,{alignItems:'center',marginBottom:8}]} onPress={function(){setIsRecurring(!isRecurring);}}>
      <View style={[z.checkbox,{marginRight:10,backgroundColor:isRecurring?'#085041':'#FFF'}]}/><Text style={z.body}>Mark as recurring transaction</Text>
    </TouchableOpacity>
    {isRecurring&&<View style={[z.card,{marginBottom:12}]}> 
      <Text style={[z.inpLabel,{marginBottom:8}]}>Frequency</Text>
      <View style={[z.row,{flexWrap:'wrap',gap:8,marginBottom:10}]}> 
        {['monthly','weekly','biweekly'].map(function(f){var sel=recurringFreq===f;return <TouchableOpacity key={f} style={[z.chip,sel&&z.chipSel]} onPress={function(){setRecurringFreq(f);}}><Text style={[z.chipTx,sel&&z.chipSelTx]}>{f}</Text></TouchableOpacity>;})}
      </View>
      {recurringFreq==='monthly'&&<Inp label="Due day (1-31)" value={dueDay} onChangeText={setDueDay} keyboardType="numeric" placeholder="1"/>}
    </View>}
    <View style={z.row}><TouchableOpacity style={[z.bSec,{flex:1,marginRight:8}]} onPress={onClose}><Text style={z.bSecT}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[z.bPri,{flex:1}]} onPress={save} disabled={loading}><Text style={z.bPriT}>{loading?'Saving...':editTx?'Update':'Save'}</Text></TouchableOpacity></View>
  </ScrollView></View></SwipeDownDismiss></KeyboardAvoidingView></Modal>);
}

// ── UPGRADED: AI-powered meal logging — user types naturally, Claude calculates nutrition ──
function AddMealModal({visible,onClose,editMeal,initialMealType,initialDate}){
  var{familyId,members,userId,isAdmin,refreshMeals,upsertMealLocal,logActivity,currentUserName}=useApp();
  var[mt,setMt]=useState('lunch');
  var[items,setItems]=useState('');
  var[mid,setMid]=useState('');
  var[loading,setLoading]=useState(false);
  var[result,setResult]=useState(null);
  var[selectedDate,setSelectedDate]=useState(new Date());
  var[photoUri,setPhotoUri]=useState('');
  var mealTypes=LIMITS.meal.allowedTypes;

  // B2: Pre-populate fields when editing an existing meal
  useEffect(function(){
    if(visible){
      if(editMeal){
        setMt((editMeal.mealTime||'lunch').toLowerCase());
        setItems(editMeal.items||'');
        setMid(editMeal.memberId||'');
        setSelectedDate(toDate(editMeal.date));
        setResult(null);
        setPhotoUri(editMeal.photo_url||editMeal.photo_path||'');
      } else {
        setMt(initialMealType||'lunch');setItems('');setMid('');setSelectedDate(initialDate?toDate(initialDate):new Date());setResult(null);setPhotoUri('');
      }
    }
  },[visible,editMeal,initialMealType,initialDate]);

  useEffect(function(){
    (async function(){
      try{
        await ImagePicker.requestCameraPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }catch(e){console.log('[MEAL PHOTO PERMISSION ERROR]',e);}
    })();
  },[]);

  async function pickImage(){
    Alert.alert('Add Photo','Choose source',[
      {text:'Take Photo',onPress:async function(){
        try{
          var cam=await ImagePicker.requestCameraPermissionsAsync();
          if(cam.status!=='granted'){Alert.alert('Permission needed','Camera permission is required to take photos.');return;}
          var result=await ImagePicker.launchCameraAsync({allowsEditing:true,quality:0.7});
          if(!result.canceled&&result.assets&&result.assets[0]&&result.assets[0].uri)setPhotoUri(result.assets[0].uri);
        }catch(e){showFriendlyError('Could not open camera',e);}
      }},
      {text:'Choose from Gallery',onPress:async function(){
        try{
          var lib=await ImagePicker.requestMediaLibraryPermissionsAsync();
          if(lib.status!=='granted'){Alert.alert('Permission needed','Photo library permission is required to choose photos.');return;}
          var result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,quality:0.7});
          if(!result.canceled&&result.assets&&result.assets[0]&&result.assets[0].uri)setPhotoUri(result.assets[0].uri);
        }catch(e){showFriendlyError('Could not open gallery',e);}
      }},
      {text:'Cancel',style:'cancel'},
    ]);
  }

  async function calculateMealNutrients(rawInput,memberId){
    var normalized=normalizeText(rawInput).toLowerCase();
    var cacheKey='meal_nutrients_v1_'+normalized;
    try{
      var cachedRaw=await AsyncStorage.getItem(cacheKey);
      if(cachedRaw){
        var cachedObj=JSON.parse(cachedRaw);
        if(cachedObj&&typeof cachedObj.protein==='number')return cachedObj;
      }
    }catch(e){console.log('[MEAL NUTRIENT CACHE READ ERROR]',e);}

    var mN=members.find(function(m){return m.id===memberId;})||members[0];
    var resp=await fetch(EDGE_MEAL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SUPABASE_ANON_KEY},body:JSON.stringify({user_id:userId,member_id:memberId||(mN&&mN.id)||null,member_name:mN?mN.name:'',meal_type:mt,raw_input:rawInput})});
    var parsed=await resp.json();
    console.log('[MEAL EDGE FN]',parsed);
    if(!resp.ok||!parsed.success)throw new Error((parsed&&parsed.error)||'Could not calculate nutrition. Try again.');
    var totals={
      protein:Number(parsed.totals&&parsed.totals.protein||0),
      carbs:Number(parsed.totals&&parsed.totals.carbs||0),
      calories:Number(parsed.totals&&parsed.totals.calories||0),
      fat:Number(parsed.totals&&parsed.totals.fat||parsed.totals&&parsed.totals.fats||0),
      cacheKey:cacheKey,
    };
    try{await AsyncStorage.setItem(cacheKey,JSON.stringify(totals));}catch(e){console.log('[MEAL NUTRIENT CACHE WRITE ERROR]',e);}
    return totals;
  }

  async function save(){
    if(result&&!editMeal){
      setMt(initialMealType||'lunch');
      setItems('');
      setMid('');
      setSelectedDate(new Date());
      setResult(null);
      setPhotoUri('');
      return;
    }
    var cleanItems=normalizeText(items);
    if(!mealTypes.includes(mt)){Alert.alert('Validation error','Please select breakfast, lunch, or dinner.');return;}
    if(!cleanItems){Alert.alert('Validation error','Please describe what you ate.');return;}
    if(cleanItems.length>LIMITS.meal.descMax){Alert.alert('Validation error','Meal description must be '+LIMITS.meal.descMax+' characters or less.');return;}
    if(isFutureDate(selectedDate)){Alert.alert('Validation error','Date cannot be in the future.');return;}
    if(mid&&!canModifyMemberData(isAdmin,members,userId,mid)){Alert.alert('Not allowed','You can only log your own meals.');return;}

    setLoading(true);setResult(null);
    try{
      var mN=members.find(function(m){return m.id===mid;})||members[0];
      var nutrients=await calculateMealNutrients(cleanItems,mid);
      var uploadedPhotoPath=photoUri;
      if(photoUri&&photoUri.indexOf('http')!==0){
        uploadedPhotoPath=await uploadPhotoToStorage('meal-photos',photoUri,userId,'meal');
      }
      var mealPayload={
        family_id:familyId,meal_time:mt.charAt(0).toUpperCase()+mt.slice(1),items:cleanItems,
        protein:nutrients.protein,carbs:nutrients.carbs,cal:nutrients.calories,
        member_id:mid||(mN&&mN.id)||'',member_name:mN?mN.name:'',date:isoDate(selectedDate),photo_path:uploadedPhotoPath||null,
      };
      if(editMeal){
        var mealUpdate=await supabase.from('meals').update(mealPayload).eq('id',editMeal.id).select().single();
        if(mealUpdate.error&&String(mealUpdate.error.message||'').toLowerCase().includes('photo_path')){
          var mealFallback=Object.assign({},mealPayload);delete mealFallback.photo_path;
          mealUpdate=await supabase.from('meals').update(mealFallback).eq('id',editMeal.id).select().single();
        }
        console.log('[MEAL UPDATE]',{id:editMeal.id,payload:mealPayload,data:mealUpdate.data,error:mealUpdate.error});
        if(mealUpdate.error)throw mealUpdate.error;
        upsertMealLocal(normMeals([mealUpdate.data])[0]);
        haptic('light');
      } else {
        var mealInsert=await supabase.from('meals').insert(mealPayload).select().single();
        if(mealInsert.error&&String(mealInsert.error.message||'').toLowerCase().includes('photo_path')){
          var mealInsertFallback=Object.assign({},mealPayload);delete mealInsertFallback.photo_path;
          mealInsert=await supabase.from('meals').insert(mealInsertFallback).select().single();
        }
        console.log('[MEAL INSERT]',{payload:mealPayload,data:mealInsert.data,error:mealInsert.error});
        if(mealInsert.error)throw mealInsert.error;
        upsertMealLocal(normMeals([mealInsert.data])[0]);
        var mid2=mealPayload.member_id||'joint';
        await recordScore(familyId,mid2,'meal_logged',15);
        if(nutrients.protein>=50){await recordScore(familyId,mid2,'protein_hit',20);}
        await bumpStreak(familyId,mid2,'meals');
        haptic('medium');
      }
      setResult({protein:nutrients.protein,carbs:nutrients.carbs,calories:nutrients.calories,fat:nutrients.fat});
      await refreshMeals();
      if(logActivity){
        await logActivity('meal',{
          user_name:currentUserName||'Someone',
          action:editMeal?'updated':'created',
          meal_time:mealPayload.meal_time,
          protein:mealPayload.protein,
          member_name:mN?mN.name:'',
        },editMeal?editMeal.id:null,familyId);
      }
      if(editMeal){setTimeout(function(){resetAndClose();},600);}
    }catch(e){console.log('[MEAL SAVE ERROR]',e);showFriendlyError(editMeal?'Could not update meal':'Could not save meal',e);}
    setLoading(false);
  }

  function resetAndClose(){setMt(initialMealType||'lunch');setItems('');setMid('');setSelectedDate(initialDate?toDate(initialDate):new Date());setResult(null);setPhotoUri('');onClose();}

  return(<Modal visible={visible} animationType="slide" transparent>
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={z.modalWrap}>
    <SwipeDownDismiss onDismiss={resetAndClose}><View style={z.modal}><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={z.h1}>{editMeal?'Edit meal':'Note a meal'}</Text>
      <SelectField label="Meal type" value={mt} onChange={setMt} options={mealTypes.map(function(t){return{label:t.charAt(0).toUpperCase()+t.slice(1),value:t};})} placeholder="Select meal type"/>
      <Text style={z.inpLabel}>Who?</Text>
      <View style={[z.row,{flexWrap:'wrap',gap:8,marginBottom:16}]}> 
        {members.map(function(m){return(
          <TouchableOpacity key={m.id} style={[z.chip,mid===m.id&&z.chipSel]} onPress={function(){setMid(m.id);}}>
            <Text style={[z.chipTx,mid===m.id&&z.chipSelTx]}>{m.name}</Text>
          </TouchableOpacity>
        );})}
      </View>
      <DateField label="Date" value={selectedDate} onChange={setSelectedDate} maximumDate={new Date()}/>
      <TouchableOpacity style={[z.bSec,{marginBottom:10,alignSelf:'flex-start'}]} onPress={pickImage}><Text style={z.bSecT}>📷 Add Photo</Text></TouchableOpacity>
      {photoUri?<Image source={{uri:photoUri}} style={z.photoPreview}/>:null}
      <Text style={z.inpLabel}>What did you eat?</Text>
      <TextInput
        style={[z.inp,{height:88,textAlignVertical:'top',paddingTop:10,marginBottom:6}]}
        value={items} onChangeText={setItems} maxLength={LIMITS.meal.descMax}
        placeholder={'e.g. 2 rotis, dal fry, curd and a banana\nor: idli sambar and chai'}
        placeholderTextColor="#888888" multiline
      />
      <Text style={[z.cap,{marginBottom:16,lineHeight:18}]}>Write naturally — AI calculates protein and calories automatically</Text>
      {result&&<View style={{backgroundColor:'#E1F5EE',borderRadius:8,padding:14,marginBottom:16}}>
        <Text style={[z.caps,{color:'#085041',marginBottom:10}]}>Meal captured \u2713</Text>
        <View style={[z.row,{justifyContent:'space-around'}]}>
          <View style={{alignItems:'center'}}><Text style={[z.heroN,{fontSize:22,color:'#085041'}]}>{result.protein}g</Text><Text style={z.cap}>Protein</Text></View>
          <View style={{alignItems:'center'}}><Text style={[z.heroN,{fontSize:22}]}>{result.calories}</Text><Text style={z.cap}>Calories</Text></View>
          <View style={{alignItems:'center'}}><Text style={[z.heroN,{fontSize:22}]}>{result.carbs}g</Text><Text style={z.cap}>Carbs</Text></View>
          <View style={{alignItems:'center'}}><Text style={[z.heroN,{fontSize:22}]}>{result.fat}g</Text><Text style={z.cap}>Fat</Text></View>
        </View>
      </View>}
      <View style={z.row}>
        <TouchableOpacity style={[z.bSec,{flex:1,marginRight:8}]} onPress={resetAndClose}><Text style={z.bSecT}>{result?'Done':'Cancel'}</Text></TouchableOpacity>
        <TouchableOpacity style={[z.bPri,{flex:1}]} onPress={save} disabled={loading||!items.trim()}>
          {loading?<ActivityIndicator color="#FFF"/>:<Text style={[z.bPriT,!items.trim()&&{opacity:0.4}]}>{editMeal?'Update Meal':(result?'Log Another':'Log Meal')}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView></View></SwipeDownDismiss>
    </KeyboardAvoidingView>
  </Modal>);
}

function AddGoalModal({visible,onClose,defaultGoalType,defaultCategory,prefillName,contextLabel}){
  var{familyId,userId,refreshGoals,refreshSharedGoals,refreshSharedGoalContributions,upsertGoalLocal,logActivity,currentUserName}=useApp();
  var[name,setName]=useState('');var[target,setTarget]=useState('');var[current,setCurrent]=useState('0');
  var[goalType,setGoalType]=useState(defaultGoalType||'personal');
  var[category,setCategory]=useState(defaultCategory||'Savings');
  var[useTargetDate,setUseTargetDate]=useState(false);
  var[targetDate,setTargetDate]=useState(new Date());
  var[loading,setLoading]=useState(false);
  var isWellnessContext=contextLabel==='Wellness';
  var todayStart=startOfDay(new Date());
  var maxTargetDate=new Date(new Date().setFullYear(new Date().getFullYear()+10));

  useEffect(function(){
    if(visible){
      setName(prefillName||'');setTarget('');setCurrent('0');
      setGoalType(isWellnessContext?'personal':(defaultGoalType||'personal'));
      setCategory(defaultCategory||'Savings');
      setUseTargetDate(false);
      setTargetDate(new Date());
    }
  },[visible,defaultGoalType,defaultCategory,prefillName,isWellnessContext]);

  async function insertPersonalGoal(payload,basePayload){
    var first=await supabase.from('goals').insert(payload).select().single();
    if(!first.error)return first;
    var message=String((first.error&&first.error.message)||'').toLowerCase();
    var likelyMissingColumn=message.includes('target_date')||message.includes('category')||message.includes('column');
    if(!likelyMissingColumn)return first;
    return await supabase.from('goals').insert(basePayload).select().single();
  }

  async function save(){
    var cleanName=normalizeText(name);
    var targetNum=parseFloat(target||'0');
    var currentNum=parseFloat(current||'0');
    if(!cleanName){Alert.alert('Validation error','Goal name is required.');return;}
    if(cleanName.length>LIMITS.goals.nameMax){Alert.alert('Validation error','Goal name must be '+LIMITS.goals.nameMax+' characters or less.');return;}
    if(isNaN(targetNum)||targetNum<=0){Alert.alert('Validation error','Target amount must be a positive number.');return;}
    if(isNaN(currentNum)||currentNum<0){Alert.alert('Validation error','Current amount cannot be negative.');return;}
    if(currentNum>targetNum){Alert.alert('Validation error','Current amount cannot be greater than the target amount.');return;}
    if(useTargetDate&&startOfDay(targetDate).getTime()<todayStart.getTime()){
      Alert.alert('Validation error','Target date must be today or in the future.');
      return;
    }

    setLoading(true);
    try{
      if(!isWellnessContext&&goalType==='shared'){
        var sharedPayload={family_id:familyId,goal_name:cleanName,target_amount:targetNum,current_amount:currentNum,created_by:userId,category:category,description:''};
        if(useTargetDate)sharedPayload.target_date=isoDate(targetDate);
        var sharedRes=await supabase.from('shared_goals').insert(sharedPayload).select().single();
        if(sharedRes.error)throw sharedRes.error;
        await refreshSharedGoals();
        await refreshSharedGoalContributions();
        if(logActivity){
          await logActivity('shared_goal',{user_name:currentUserName||'Someone',action:'created',goal_name:cleanName,target_amount:targetNum,current_amount:currentNum,category:category,goal_scope:'family'},sharedRes.data&&sharedRes.data.id,familyId);
        }
      } else {
        var basePayload={family_id:familyId,name:cleanName,target:targetNum,current:currentNum,goal_type:'personal',is_shared:false};
        var personalPayload=Object.assign({},basePayload,{category:category,target_date:useTargetDate?isoDate(targetDate):null,goal_scope:'personal'});
        var goalRes=await insertPersonalGoal(personalPayload,basePayload);
        if(goalRes.error)throw goalRes.error;
        upsertGoalLocal(goalRes.data);
        await refreshGoals();
        if(logActivity){
          await logActivity('goal',{user_name:currentUserName||'Someone',action:'created',goal_name:cleanName,target_amount:targetNum,current_amount:currentNum,category:category,goal_scope:'personal'},goalRes.data&&goalRes.data.id,familyId);
        }
      }
      onClose();
    }catch(e){
      console.log('[GOAL INSERT ERROR]',e);
      showFriendlyError('Could not save goal',e);
    }
    setLoading(false);
  }

  return(<Modal visible={visible} animationType="slide" transparent><View style={z.modalWrap}><View style={z.modal}><ScrollView showsVerticalScrollIndicator={false}>
    <Text style={z.h1}>{contextLabel?('Create '+contextLabel+' Goal'):'Create Goal'}</Text>
    {!isWellnessContext&&<><Text style={z.inpLabel}>Goal type</Text>
    <View style={[z.row,{gap:8,marginBottom:6}]}> 
      <TouchableOpacity style={[z.chip,goalType==='personal'&&z.chipSel]} onPress={function(){setGoalType('personal');}}><Text style={[z.chipTx,goalType==='personal'&&z.chipSelTx]}>Personal Goal</Text></TouchableOpacity>
      <TouchableOpacity style={[z.chip,goalType==='shared'&&z.chipSel]} onPress={function(){setGoalType('shared');}}><Text style={[z.chipTx,goalType==='shared'&&z.chipSelTx]}>Shared Family Goal</Text></TouchableOpacity>
    </View>
    <Text style={[z.cap,{marginBottom:12}]}>{goalType==='personal'?'Only you can update this goal.':'All family members can view and contribute to this goal.'}</Text></>}
    <Inp label="Goal Name" value={name} onChangeText={setName} placeholder="Run 5km weekly, Save for bike..." maxLength={LIMITS.goals.nameMax}/>
    <Inp label="Target Amount" value={target} onChangeText={setTarget} placeholder="100" keyboardType="numeric"/>
    <Inp label="Current Amount (optional)" value={current} onChangeText={setCurrent} placeholder="0" keyboardType="numeric"/>
    <SelectField label="Category" value={category} onChange={setCategory} options={contextLabel==='Wellness'?WELLNESS_GOAL_CATEGORY_OPTIONS:SHARED_GOAL_CATEGORY_OPTIONS} placeholder="Select category"/>
    <TouchableOpacity style={[z.row,{alignItems:'center',marginBottom:8}]} onPress={function(){setUseTargetDate(!useTargetDate);}}>
      <View style={[z.checkbox,{marginRight:10,backgroundColor:useTargetDate?'#085041':'#FFF'}]}/><Text style={z.body}>Set target date (optional)</Text>
    </TouchableOpacity>
    {useTargetDate&&<DateField label="Target date" value={targetDate} onChange={setTargetDate} minimumDate={todayStart} maximumDate={maxTargetDate}/>}
    <Text style={[z.cap,{marginBottom:12}]}>Tip: Use any units you want (rupees, kms, days, books, etc.)</Text>
    <View style={z.row}><TouchableOpacity style={[z.bSec,{flex:1,marginRight:8}]} onPress={onClose}><Text style={z.bSecT}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[z.bPri,{flex:1}]} onPress={save} disabled={loading}><Text style={z.bPriT}>{loading?'Saving...':'Create Goal'}</Text></TouchableOpacity></View>
  </ScrollView></View></View></Modal>);
}

function EditGoalModal({visible,onClose,goal,familyId}){
  var{refreshGoals,upsertGoalLocal,removeGoalLocal,logActivity,currentUserName}=useApp();
  var[name,setName]=useState('');var[target,setTarget]=useState('');var[current,setCurrent]=useState('');var[loading,setLoading]=useState(false);
  useEffect(function(){
    if(visible&&goal){
      setName(goal.name||'');
      setTarget(String(goal.target||0));
      setCurrent(String(goal.current||0));
    }
  },[visible,goal]);
  async function save(){
    if(!goal)return;
    var cleanName=normalizeText(name);
    var targetNum=parseFloat(target||'0');
    var currentNum=parseFloat(current||'0');
    if(!cleanName){Alert.alert('Validation error','Goal name is required.');return;}
    if(cleanName.length>LIMITS.goals.nameMax){Alert.alert('Validation error','Goal name must be '+LIMITS.goals.nameMax+' characters or less.');return;}
    if(isNaN(targetNum)||targetNum<=0){Alert.alert('Validation error','Target amount must be a positive number.');return;}
    if(isNaN(currentNum)||currentNum<0){Alert.alert('Validation error','Current amount cannot be negative.');return;}
    if(currentNum>targetNum){Alert.alert('Validation error','Current amount cannot be greater than the target amount.');return;}
    setLoading(true);
    try{
      var prevAmt=goal.current||0;
      var{data,error}=await supabase.from('goals').update({name:cleanName,target:targetNum,current:currentNum}).eq('id',goal.id).select().single();
      console.log('[GOAL UPDATE]',{id:goal.id,data:data,error:error});
      if(error)throw error;
      upsertGoalLocal(data);
      if(currentNum>prevAmt && familyId){
        await recordScore(familyId,'joint','goal_contribution',10);
        var wasAt50=goal.target>0 && prevAmt/goal.target>=0.5;
        var nowAt50=targetNum>0 && currentNum/targetNum>=0.5;
        if(!wasAt50 && nowAt50){await recordScore(familyId,'joint','goal_half',25);haptic('success');}
        var wasAt100=goal.target>0 && prevAmt>=goal.target;
        var nowAt100=targetNum>0 && currentNum>=targetNum;
        if(!wasAt100 && nowAt100){await recordScore(familyId,'joint','goal_complete',75);haptic('heavy');}
      }
      await refreshGoals();
      if(logActivity){await logActivity('goal',{user_name:currentUserName||'Someone',action:'updated',goal_name:cleanName,target_amount:targetNum,current_amount:currentNum},goal.id,familyId);} 
      onClose();
    }catch(e){console.log('[GOAL UPDATE ERROR]',e);haptic('error');showFriendlyError('Could not update goal',e);}
    setLoading(false);
  }
  async function deleteGoal(){
    if(!goal)return;
    Alert.alert('Delete goal?','This will remove this goal permanently.',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete',style:'destructive',onPress:async function(){
        setLoading(true);
        try{
          var{error}=await supabase.from('goals').delete().eq('id',goal.id);
          if(error)throw error;
          removeGoalLocal(goal.id);
          await refreshGoals();
          if(logActivity){await logActivity('goal',{user_name:currentUserName||'Someone',action:'deleted',goal_name:goal.name,target_amount:goal.target,current_amount:goal.current},goal.id,familyId);} 
          haptic('success');
          onClose();
        }catch(e){haptic('error');showFriendlyError('Could not delete goal',e);}finally{setLoading(false);}
      }},
    ]);
  }
  return(<Modal visible={visible} animationType="slide" transparent><View style={z.modalWrap}><View style={z.modal}><Text style={z.h1}>Edit Goal</Text>
    <Inp label="Goal Name" value={name} onChangeText={setName} maxLength={LIMITS.goals.nameMax}/>
    <Inp label="Target" value={target} onChangeText={setTarget} keyboardType="numeric"/>
    <Inp label="Current Progress" value={current} onChangeText={setCurrent} keyboardType="numeric"/>
    <View style={[z.row,{marginTop:4}]}> 
      <TouchableOpacity style={[z.bSec,{flex:1,marginRight:8}]} onPress={onClose}><Text style={z.bSecT}>Cancel</Text></TouchableOpacity>
      <TouchableOpacity style={[z.bPri,{flex:1}]} onPress={save} disabled={loading}><Text style={z.bPriT}>{loading?'Saving...':'Save Changes'}</Text></TouchableOpacity>
    </View>
    <TouchableOpacity style={[z.bSec,{marginTop:10,borderColor:'#E24B4A'}]} onPress={deleteGoal}><Text style={[z.bSecT,{color:'#E24B4A'}]}>Delete Goal</Text></TouchableOpacity>
  </View></View></Modal>);
}

// B3: Split the old combined LogWellnessModal into two dedicated modals —
// one for water, one for screen time — each opens directly with no intermediate step.
function TransactionCommentsModal({visible,onClose,transaction}){
  var{userId,currentUserName,members,transactionComments,refreshTransactionComments,logActivity,familyId}=useApp();
  var[text,setText]=useState('');
  var[sending,setSending]=useState(false);
  var comments=(transactionComments||[]).filter(function(c){return c.transaction_id===((transaction&&transaction.id)||'');}).sort(function(a,b){return String(a.created_at).localeCompare(String(b.created_at));});

  async function send(){
    var clean=normalizeText(text);
    if(!clean||!transaction)return;
    setSending(true);
    try{
      var payload={
        family_id:familyId,
        transaction_id:transaction.id,
        user_id:userId,
        user_name:currentUserName||'You',
        comment_text:clean,
      };
      var r=await supabase.from('transaction_comments').insert(payload).select().single();
      if(r.error)throw r.error;
      setText('');
      await refreshTransactionComments();
      if(logActivity){
        await logActivity('comment',{
          user_name:currentUserName||'Someone',
          transaction_name:transaction.merchant||'transaction',
          comment_text:clean,
        },transaction.id,familyId);
      }
      haptic('light');
    }catch(e){showFriendlyError('Could not send comment',e);}finally{setSending(false);}
  }

  return <Modal visible={visible} transparent animationType="slide"><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={z.modalWrap}><View style={z.modal}>
    <View style={[z.row,{justifyContent:'space-between',marginBottom:8}]}> 
      <View style={{flex:1}}><Text style={z.h1}>Transaction comments</Text><Text style={z.cap}>{transaction?transaction.merchant:''}</Text></View>
      <TouchableOpacity onPress={onClose}><Text style={z.bSecT}>Close</Text></TouchableOpacity>
    </View>
    <ScrollView style={{maxHeight:320,marginBottom:10}}>
      {comments.map(function(c){
        var mine=c.user_id===userId;
        return <View key={c.id} style={[z.commentBubble,mine?z.commentMine:z.commentOther]}>
          <View style={[z.row,{marginBottom:3}]}> 
            <Text style={[z.cap,{fontWeight:'500'}]}>{mine?'You':(c.user_name||'Member')}</Text>
            <Text style={[z.cap,{marginLeft:8}]}>{relativeTime(c.created_at)}</Text>
          </View>
          <Text style={z.body}>{c.comment_text}</Text>
        </View>;
      })}
      {comments.length===0&&<Text style={z.cap}>No comments yet. Start the conversation.</Text>}
    </ScrollView>
    <View style={[z.row,{alignItems:'flex-end'}]}>
      <TextInput style={[z.inp,{flex:1,height:44}]} value={text} onChangeText={setText} placeholder="Write a comment..." placeholderTextColor="#888888"/>
      <TouchableOpacity style={[z.bPri,{marginLeft:8,opacity:sending?0.7:1}]} onPress={send} disabled={sending}><Text style={z.bPriT}>{sending?'...':'Send'}</Text></TouchableOpacity>
    </View>
  </View></KeyboardAvoidingView></Modal>;
}

function SharedGoalModal({visible,onClose,goal}){
  var{familyId,userId,currentUserName,refreshSharedGoals,refreshSharedGoalContributions,sharedGoalContributions,logActivity}=useApp();
  var[name,setName]=useState('');var[target,setTarget]=useState('');var[targetDate,setTargetDate]=useState(new Date());var[category,setCategory]=useState('General');var[description,setDescription]=useState('');var[saving,setSaving]=useState(false);
  useEffect(function(){
    if(visible&&goal){setName(goal.goal_name||'');setTarget(String(goal.target_amount||0));setCategory(goal.category||'General');setDescription(goal.description||'');setTargetDate(goal.target_date?new Date(goal.target_date):new Date());}
    if(visible&&!goal){setName('');setTarget('');setCategory('General');setDescription('');setTargetDate(new Date());}
  },[visible,goal]);

  var todayStart=startOfDay(new Date());
  var maxTargetDate=new Date(new Date().setFullYear(new Date().getFullYear()+10));

  async function save(){
    var clean=normalizeText(name);var targetNum=parseFloat(target||'0');
    if(!clean){Alert.alert('Validation','Goal name is required');return;}
    if(isNaN(targetNum)||targetNum<=0){Alert.alert('Validation','Target amount must be positive');return;}
    if(startOfDay(targetDate).getTime()<todayStart.getTime()){Alert.alert('Validation','Target date must be today or in the future.');return;}
    setSaving(true);
    try{
      if(goal){
        var up=await supabase.from('shared_goals').update({goal_name:clean,target_amount:targetNum,target_date:isoDate(targetDate),category:category,description:description,updated_at:new Date().toISOString()}).eq('id',goal.id).select().single();
        if(up.error)throw up.error;
        if(logActivity)await logActivity('shared_goal',{user_name:currentUserName||'Someone',action:'updated',goal_name:clean,target_amount:targetNum},goal.id,familyId);
      } else {
        var ins=await supabase.from('shared_goals').insert({family_id:familyId,goal_name:clean,target_amount:targetNum,current_amount:0,created_by:userId,target_date:isoDate(targetDate),category:category,description:description}).select().single();
        if(ins.error)throw ins.error;
        if(logActivity)await logActivity('shared_goal',{user_name:currentUserName||'Someone',action:'created',goal_name:clean,target_amount:targetNum},ins.data.id,familyId);
      }
      await refreshSharedGoals();
      await refreshSharedGoalContributions();
      onClose();
    }catch(e){showFriendlyError('Could not save shared goal',e);}finally{setSaving(false);}
  }

  return <Modal visible={visible} transparent animationType="slide"><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={z.modalWrap}><View style={z.modal}><ScrollView>
    <Text style={z.h1}>{goal?'Edit Shared Goal':'Create Shared Goal'}</Text>
    <Inp label="Goal name" value={name} onChangeText={setName} placeholder="Family Vacation Fund"/>
    <Inp label="Target amount" value={target} onChangeText={setTarget} keyboardType="numeric" placeholder="50000"/>
    <DateField label="Target date" value={targetDate} onChange={setTargetDate} minimumDate={todayStart} maximumDate={maxTargetDate}/>
    <SelectField label="Category" value={category} onChange={setCategory} options={SHARED_GOAL_CATEGORY_OPTIONS} placeholder="Select category"/>
    <Inp label="Description" value={description} onChangeText={setDescription} multiline placeholder="Optional details"/>
    <View style={z.row}><TouchableOpacity style={[z.bSec,{flex:1,marginRight:8}]} onPress={onClose}><Text style={z.bSecT}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[z.bPri,{flex:1}]} onPress={save} disabled={saving}><Text style={z.bPriT}>{saving?'Saving...':'Save'}</Text></TouchableOpacity></View>
  </ScrollView></View></KeyboardAvoidingView></Modal>;
}

function SharedGoalContributionModal({visible,onClose,goal}){
  var{familyId,userId,currentUserName,refreshSharedGoals,refreshSharedGoalContributions,logActivity}=useApp();
  var[amount,setAmount]=useState('');var[note,setNote]=useState('');var[saving,setSaving]=useState(false);
  useEffect(function(){if(visible){setAmount('');setNote('');}},[visible]);
  async function add(){
    var num=parseFloat(amount||'0');
    if(!goal)return;
    if(isNaN(num)||num<=0){Alert.alert('Validation','Contribution amount must be positive');return;}
    setSaving(true);
    try{
      var ins=await supabase.from('shared_goal_contributions').insert({family_id:familyId,shared_goal_id:goal.id,user_id:userId,user_name:currentUserName||'Member',amount:num,note:note||null}).select().single();
      if(ins.error)throw ins.error;
      var newCurrent=Number(goal.current_amount||0)+num;
      var up=await supabase.from('shared_goals').update({current_amount:newCurrent,updated_at:new Date().toISOString()}).eq('id',goal.id);
      if(up.error)throw up.error;
      await refreshSharedGoalContributions();
      await refreshSharedGoals();
      if(logActivity)await logActivity('shared_goal_contribution',{user_name:currentUserName||'Someone',goal_name:goal.goal_name,amount:num},goal.id,familyId);
      onClose();
    }catch(e){showFriendlyError('Could not add contribution',e);}finally{setSaving(false);}
  }
  return <Modal visible={visible} transparent animationType="slide"><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={z.modalWrap}><View style={z.modal}>
    <Text style={z.h1}>Add to this goal</Text>
    <Text style={[z.cap,{marginBottom:10}]}>{goal?goal.goal_name:''}</Text>
    <Inp label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="1000"/>
    <Inp label="Note (optional)" value={note} onChangeText={setNote} placeholder="For this month's savings"/>
    <View style={z.row}><TouchableOpacity style={[z.bSec,{flex:1,marginRight:8}]} onPress={onClose}><Text style={z.bSecT}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[z.bPri,{flex:1}]} onPress={add} disabled={saving}><Text style={z.bPriT}>{saving?'Saving...':'Add'}</Text></TouchableOpacity></View>
  </View></KeyboardAvoidingView></Modal>;
}

function ProfileModal({visible,onClose}){
  var{userId}=useApp();
  var theme=useThemeColors();
  var[loadingProfile,setLoadingProfile]=useState(false);
  var[profileData,setProfileData]=useState(null);

  async function loadProfile(){
    if(!userId)return;
    setLoadingProfile(true);
    try{
      var {data,error}=await supabase
        .from('users')
        .select([
          DB_COLUMNS.USERS.NAME,
          DB_COLUMNS.USERS.EMAIL,
          DB_COLUMNS.USERS.PHONE,
          DB_COLUMNS.USERS.DOB,
          DB_COLUMNS.USERS.GENDER,
          DB_COLUMNS.USERS.HEIGHT,
          DB_COLUMNS.USERS.WEIGHT,
          DB_COLUMNS.USERS.LOCATION,
          DB_COLUMNS.USERS.OCCUPATION,
          DB_COLUMNS.USERS.LANGUAGE,
        ].join(','))
        .eq('id',userId)
        .single();
      if(error)throw error;
      setProfileData(data||null);
    }catch(err){
      console.error('[PROFILE LOAD ERROR]',err);
      showFriendlyError('Could not load profile',err);
    }finally{setLoadingProfile(false);}
  }

  useEffect(function(){
    if(visible)loadProfile();
  },[visible,userId]);

  return <Modal visible={visible} transparent animationType="slide"><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={[z.modalWrap,{backgroundColor:theme.overlay}]}><View style={[z.modal,{backgroundColor:theme.card}] }><ScrollView>
    <Text style={[z.h1,{color:theme.text}]}>Profile Management</Text>
    {loadingProfile&&<Text style={[z.cap,{marginBottom:8,color:theme.muted}]}>Loading profile data...</Text>}
    {!loadingProfile&&profileData&&<View>
      <Text style={[z.body,{color:theme.text,marginBottom:8}]}>Name: {profileData.name||'Not set yet'}</Text>
      <Text style={[z.body,{color:theme.text,marginBottom:8}]}>Email: {profileData.email||'-'}</Text>
      <Text style={[z.body,{color:theme.text,marginBottom:8}]}>Phone: {profileData.phone||'-'}</Text>
      <Text style={[z.body,{color:theme.text,marginBottom:8}]}>DOB: {profileData.dob||'-'}</Text>
      <Text style={[z.body,{color:theme.text,marginBottom:8}]}>Gender: {profileData.gender||'-'}</Text>
      <Text style={[z.body,{color:theme.text,marginBottom:8}]}>Height: {profileData.height!==null&&profileData.height!==undefined?profileData.height+' cm':'-'}</Text>
      <Text style={[z.body,{color:theme.text,marginBottom:8}]}>Weight: {profileData.weight!==null&&profileData.weight!==undefined?profileData.weight+' kg':'-'}</Text>
      <Text style={[z.body,{color:theme.text,marginBottom:8}]}>Location: {profileData.location||'-'}</Text>
      <Text style={[z.body,{color:theme.text,marginBottom:8}]}>Occupation: {profileData.occupation||'-'}</Text>
      <Text style={[z.body,{color:theme.text,marginBottom:8}]}>Language: {profileData.language||'-'}</Text>
    </View>}
    {!loadingProfile&&!profileData&&<Text style={[z.body,{color:theme.muted}]}>No profile data found.</Text>}
    <View style={z.row}><TouchableOpacity style={[z.bPri,{flex:1,backgroundColor:theme.primary}]} onPress={onClose}><Text style={z.bPriT}>Close</Text></TouchableOpacity></View>
  </ScrollView></View></KeyboardAvoidingView></Modal>;
}

function LogWaterModal({visible,onClose,initialDate}){
  var{familyId,members,userId,isAdmin,wellness,refreshWellness,upsertWellnessLocal,logActivity,currentUserName}=useApp();var[mid,setMid]=useState('');var[water,setWater]=useState('');var[loading,setLoading]=useState(false);var[selectedDate,setSelectedDate]=useState(new Date());
  useEffect(function(){if(visible){setMid('');setWater('');setSelectedDate(initialDate?toDate(initialDate):new Date());}},[visible,initialDate]);
  function bump(delta){var n=parseInt(water||'0',10);if(isNaN(n))n=0;n=Math.max(0,n+delta);setWater(String(n));}
  async function save(){
    if(!mid){Alert.alert('Validation error','Please select a member.');return;}
    if(!canModifyMemberData(isAdmin,members,userId,mid)){Alert.alert('Not allowed','You can only log your own data.');return;}
    var waterNum=parseInt(water||'0',10);
    if(isNaN(waterNum)||waterNum<LIMITS.wellness.waterMin){Alert.alert('Validation error','Water must be at least 1 glass.');return;}
    if(waterNum>LIMITS.wellness.waterMax){Alert.alert('Validation error','Water cannot be more than '+LIMITS.wellness.waterMax+' glasses in one entry.');return;}
    if(isFutureDate(selectedDate)){Alert.alert('Validation error','Date cannot be in the future.');return;}
    setLoading(true);
    try{
      var today=isoDate(selectedDate);var mN=members.find(function(m){return m.id===mid;});
      var{data:existing,error:existingErr}=await supabase.from('wellness').select('*').eq('family_id',familyId).eq('member_id',mid).eq('date',today).maybeSingle();
      if(existingErr)throw existingErr;
      var prev=existing||{};
      var prevLitres=Number(prev.water||0);
      var addLitres=glassesToLitres(waterNum);
      var newWaterTotal=Number((prevLitres+addLitres).toFixed(2));
      var payload={family_id:familyId,member_id:mid,member_name:mN?mN.name:'',water:newWaterTotal,screen_hrs:prev.screen_hrs||0,date:today,updated_at:new Date().toISOString()};
      var{data,error}=await supabase.from('wellness').upsert(payload,{onConflict:'family_id,member_id,date'}).select().single();
      console.log('[WATER UPSERT]',{payload:payload,data:data,error:error});
      if(error)throw error;
      upsertWellnessLocal(normWellness([data])[0]);
      await refreshWellness();
      await recordScore(familyId,mid,'water_logged',10);
      await bumpStreak(familyId,mid,'water');
      if(logActivity){await logActivity('wellness',{user_name:currentUserName||'Someone',log_type:'water',member_name:mN?mN.name:'',water_added_glasses:waterNum,water_added_litres:addLitres,water_total_litres:Number((data&&data.water)||0)},data&&data.id,familyId);}
      haptic('medium');
      setMid('');setWater('');setSelectedDate(initialDate?toDate(initialDate):new Date());onClose();
    }catch(e){console.log('[WATER SAVE ERROR]',e);showFriendlyError('Could not save water log',e);}
    setLoading(false);
  }
  return(<Modal visible={visible} animationType="slide" transparent><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={z.modalWrap}><SwipeDownDismiss onDismiss={onClose}><View style={z.modal}>
    <Text style={z.h1}>Note water</Text>
    <Text style={z.inpLabel}>Who?</Text>
    <View style={[z.row,{flexWrap:'wrap',gap:8,marginBottom:16}]}>{members.map(function(m){return<TouchableOpacity key={m.id} style={[z.chip,mid===m.id&&z.chipSel]} onPress={function(){setMid(m.id);}}><Text style={[z.chipTx,mid===m.id&&z.chipSelTx]}>{m.name}</Text></TouchableOpacity>;})}</View>
    <Text style={z.inpLabel}>How many glasses?</Text>
    <View style={[z.row,{gap:8,marginBottom:16,alignItems:'center'}]}>
      <TouchableOpacity style={z.stepBtn} onPress={function(){bump(-1);}}><Text style={z.stepTx}>−</Text></TouchableOpacity>
      <TextInput style={[z.inp,{flex:1,textAlign:'center',fontSize:20}]} value={water} onChangeText={setWater} placeholder="0" placeholderTextColor="#888888" keyboardType="numeric"/>
      <TouchableOpacity style={z.stepBtn} onPress={function(){bump(1);}}><Text style={z.stepTx}>+</Text></TouchableOpacity>
    </View>
    <DateField label="Date" value={selectedDate} onChange={setSelectedDate} maximumDate={new Date()}/>
    {mid&&<Text style={[z.cap,{marginBottom:10}]}>So far on {isoDate(selectedDate)}: {formatWaterFromLitres((wellness||[]).filter(function(w){return w.memberId===mid&&w.date===isoDate(selectedDate);}).reduce(function(sum,w){return sum+Number(w.water||0);},0))}</Text>}
    <View style={z.row}><TouchableOpacity style={[z.bSec,{flex:1,marginRight:8}]} onPress={onClose}><Text style={z.bSecT}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[z.bPri,{flex:1}]} onPress={save} disabled={loading}><Text style={z.bPriT}>{loading?'Saving...':'Save'}</Text></TouchableOpacity></View>
  </View></SwipeDownDismiss></KeyboardAvoidingView></Modal>);
}

function LogScreenTimeModal({visible,onClose,initialDate}){
  var{familyId,members,userId,isAdmin,wellness,refreshWellness,upsertWellnessLocal,logActivity,currentUserName}=useApp();var[mid,setMid]=useState('');var[hrs,setHrs]=useState('');var[mins,setMins]=useState('');var[loading,setLoading]=useState(false);var[selectedDate,setSelectedDate]=useState(new Date());
  useEffect(function(){if(visible){setMid('');setHrs('');setMins('');setSelectedDate(initialDate?toDate(initialDate):new Date());}},[visible,initialDate]);
  async function save(){
    if(!mid){Alert.alert('Validation error','Please select a member.');return;}
    if(!canModifyMemberData(isAdmin,members,userId,mid)){Alert.alert('Not allowed','You can only log your own data.');return;}
    var h=parseFloat(hrs||'0');var m=parseFloat(mins||'0');
    if(isNaN(h))h=0;if(isNaN(m))m=0;
    if(h<0||m<0){Alert.alert('Validation error','Screen time cannot be negative.');return;}
    var total=h+(m/60);
    if(total<=0){Alert.alert('Validation error','Enter hours or minutes.');return;}
    if(total>LIMITS.wellness.screenMaxHours){Alert.alert('Validation error','Screen time cannot exceed '+LIMITS.wellness.screenMaxHours+' hours.');return;}
    if(isFutureDate(selectedDate)){Alert.alert('Validation error','Date cannot be in the future.');return;}
    setLoading(true);
    try{
      var today=isoDate(selectedDate);var mN=members.find(function(m2){return m2.id===mid;});
      var{data:existing,error:existingErr}=await supabase.from('wellness').select('*').eq('family_id',familyId).eq('member_id',mid).eq('date',today).maybeSingle();
      if(existingErr)throw existingErr;
      var prev=existing||{};
      var rounded=Math.round(total*10)/10;
      var newScreenTotal=Math.round((Number(prev.screen_hrs||0)+rounded)*10)/10;
      if(newScreenTotal>LIMITS.wellness.screenMaxHours){Alert.alert('Validation error','Total screen time for the day cannot exceed '+LIMITS.wellness.screenMaxHours+' hours.');setLoading(false);return;}
      var payload={family_id:familyId,member_id:mid,member_name:mN?mN.name:'',water:prev.water||0,screen_hrs:newScreenTotal,date:today,updated_at:new Date().toISOString()};
      var{data,error}=await supabase.from('wellness').upsert(payload,{onConflict:'family_id,member_id,date'}).select().single();
      console.log('[SCREEN UPSERT]',{payload:payload,data:data,error:error});
      if(error)throw error;
      upsertWellnessLocal(normWellness([data])[0]);
      await refreshWellness();
      if(total<=4){await recordScore(familyId,mid,'screen_under_limit',15);}
      await bumpStreak(familyId,mid,'screen');
      if(logActivity){await logActivity('wellness',{user_name:currentUserName||'Someone',log_type:'screen_time',member_name:mN?mN.name:'',screen_added:rounded,screen_total:Number((data&&data.screen_hrs)||0)},data&&data.id,familyId);}
      haptic('medium');
      setMid('');setHrs('');setMins('');setSelectedDate(initialDate?toDate(initialDate):new Date());onClose();
    }catch(e){console.log('[SCREEN SAVE ERROR]',e);showFriendlyError('Could not save screen time',e);}
    setLoading(false);
  }
  return(<Modal visible={visible} animationType="slide" transparent><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={z.modalWrap}><SwipeDownDismiss onDismiss={onClose}><View style={z.modal}>
    <Text style={z.h1}>Note screen time</Text>
    <Text style={z.inpLabel}>Who?</Text>
    <View style={[z.row,{flexWrap:'wrap',gap:8,marginBottom:16}]}>{members.map(function(m){return<TouchableOpacity key={m.id} style={[z.chip,mid===m.id&&z.chipSel]} onPress={function(){setMid(m.id);}}><Text style={[z.chipTx,mid===m.id&&z.chipSelTx]}>{m.name}</Text></TouchableOpacity>;})}</View>
    <View style={[z.row,{gap:8,marginBottom:16}]}> 
      <View style={{flex:1}}><Text style={z.inpLabel}>Hours</Text><TextInput style={z.inp} value={hrs} onChangeText={setHrs} placeholder="3" placeholderTextColor="#888888" keyboardType="numeric"/></View>
      <View style={{flex:1}}><Text style={z.inpLabel}>Minutes</Text><TextInput style={z.inp} value={mins} onChangeText={setMins} placeholder="15" placeholderTextColor="#888888" keyboardType="numeric"/></View>
    </View>
    <DateField label="Date" value={selectedDate} onChange={setSelectedDate} maximumDate={new Date()}/>
    {mid&&<Text style={[z.cap,{marginBottom:10}]}>So far on {isoDate(selectedDate)}: {(wellness||[]).filter(function(w){return w.memberId===mid&&w.date===isoDate(selectedDate);}).reduce(function(sum,w){return sum+Number(w.screenHrs||w.screen_hrs||0);},0).toFixed(1)} hrs</Text>}
    <View style={z.row}><TouchableOpacity style={[z.bSec,{flex:1,marginRight:8}]} onPress={onClose}><Text style={z.bSecT}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[z.bPri,{flex:1}]} onPress={save} disabled={loading}><Text style={z.bPriT}>{loading?'Saving...':'Save'}</Text></TouchableOpacity></View>
  </View></SwipeDownDismiss></KeyboardAvoidingView></Modal>);
}

// ═══════════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════════
function HomeScreen(){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var navigation=useNavigation();
  var{familyId,familyName,members,transactions,meals,goals,wellness,todayNudge,openSettings,setQuickAction,userCreatedAt,userId,refreshTransactions,upsertTransactionLocal,dismissNudge,dismissedNudgeIds,waterTrackingEnabled,refreshMeals,refreshWellness,refreshActivityFeed,refreshNudges}=useApp();
  var[showTx,setShowTx]=useState(false);
  var[editTx,setEditTx]=useState(null); // B2: holds the transaction being edited
  var[catchupDismissed,setCatchupDismissed]=useState(false); // B4: checklist only surfaces once per morning
  var[todayStatus,setTodayStatus]=useState({loading:true,missing:[]});
  var[checklistVisible,setChecklistVisible]=useState(false);
  var[showDayDetail,setShowDayDetail]=useState(false);
  var[dayDetailDate,setDayDetailDate]=useState(new Date());
  var[refreshing,setRefreshing]=useState(false);
  // Store today's date string to detect "new day" — resets the catchup state on first open of a new day
  var[catchupDay,setCatchupDay]=useState(isoDate(new Date()));
  useEffect(function(){
    var today=isoDate(new Date());
    if(today!==catchupDay){setCatchupDay(today);setCatchupDismissed(false);}
  },[]);

  async function onPullRefresh(){
    setRefreshing(true);
    try{
      await Promise.all([
        refreshTransactions&&refreshTransactions(),
        refreshMeals&&refreshMeals(),
        refreshWellness&&refreshWellness(),
        refreshActivityFeed&&refreshActivityFeed(),
        refreshNudges&&refreshNudges(),
      ].filter(Boolean));
    }catch(e){console.log('[HOME PULL REFRESH ERROR]',e);}
    setRefreshing(false);
  }

  function jumpProteinToMember(memberName){
    setQuickAction&&setQuickAction({action:'focus_member',memberName:memberName,nonce:Date.now()});
    navigation.navigate('Wellness');
  }
  function jumpToFinanceCategory(cat){
    setQuickAction&&setQuickAction({action:'filter_category',category:cat,nonce:Date.now()});
    navigation.navigate('Finance');
  }
  function jumpToInsightsThisWeek(){
    setQuickAction&&setQuickAction({action:'focus_week',nonce:Date.now()});
    navigation.navigate('Insights');
  }
  function jumpToInsightsMonth(){
    setQuickAction&&setQuickAction({action:'focus_month',nonce:Date.now()});
    navigation.navigate('Insights');
  }
  function openDayDetail(date){
    setDayDetailDate(toDate(date));
    setShowDayDetail(true);
  }

  async function shouldShowChecklist(){
    try{
      if(!userCreatedAt||!userId)return false;
      var accountAge=differenceInDays(new Date(),new Date(userCreatedAt));
      if(accountAge<1)return false;
      var today=formatDateISO(new Date());

      var txRes=await supabase.from('transactions').select('id').eq('user_id',userId).eq('date',today);
      if(txRes.error)throw txRes.error;
      if(!txRes.data||txRes.data.length===0)return true;

      var mealRes=await supabase.from('meals').select('id').eq('user_id',userId).eq('date',today);
      if(mealRes.error)throw mealRes.error;
      if(!mealRes.data||mealRes.data.length===0)return true;

      var wellnessRes=await supabase.from('wellness').select('id').eq('user_id',userId).eq('date',today);
      if(wellnessRes.error)throw wellnessRes.error;
      if(!wellnessRes.data||wellnessRes.data.length===0)return true;

      return false;
    }catch(e){
      console.log('[CHECKLIST VISIBILITY FALLBACK]',e);
      var accountAgeFallback=userCreatedAt?differenceInDays(new Date(),new Date(userCreatedAt)):0;
      return accountAgeFallback>=1;
    }
  }

  useEffect(function(){
    var alive=true;
    (async function(){
      var next=await shouldShowChecklist();
      if(alive)setChecklistVisible(next);
    })();
    return function(){alive=false;};
  },[userCreatedAt,userId,transactions,meals,wellness]);

  useEffect(function(){
    if(!familyId){
      setTodayStatus({loading:false,missing:[]});
      return;
    }
    var tISO=isoDate(new Date());
    var hasTx=(transactions||[]).some(function(t){return t.family_id===familyId&&isoDate(t.date)===tISO;});
    function hadMeal(type){return (meals||[]).some(function(m){return m.family_id===familyId&&isoDate(m.date)===tISO&&String(m.mealTime||m.meal_time||'').toLowerCase()===type;});}
    var hasBreakfast=hadMeal('breakfast');
    var hasLunch=hadMeal('lunch');
    var hasDinner=hadMeal('dinner');
    var dayWell=(wellness||[]).filter(function(w){return w.family_id===familyId&&w.date===tISO;});
    var hasScreen=dayWell.some(function(w){return (w.screenHrs||0)>0||(w.screen_hrs||0)>0;});
    var missing=[];
    if(!hasTx)missing.push({key:'today-finance',label:'Capture an expense or income',tab:'Finance',action:'open_tx'});
    if(!hasBreakfast)missing.push({key:'today-breakfast',label:'Note breakfast',tab:'Wellness',action:'open_meal',mealType:'breakfast'});
    if(!hasLunch)missing.push({key:'today-lunch',label:'Note lunch',tab:'Wellness',action:'open_meal',mealType:'lunch'});
    if(!hasDinner)missing.push({key:'today-dinner',label:'Note dinner',tab:'Wellness',action:'open_meal',mealType:'dinner'});
    if(!hasScreen)missing.push({key:'today-screen',label:'Note screen time',tab:'Wellness',action:'open_screen'});
    setTodayStatus({loading:false,missing:missing});
  },[familyId,transactions,meals,wellness]);
  var now=new Date();var monthTxs=transactions.filter(function(t){return isThisMonth(t.date);});
  var income=monthTxs.filter(function(t){return t.category==='Income';}).reduce(function(s,t){return s+t.amount;},0);
  var expenses=monthTxs.filter(function(t){return t.category!=='Income';}).reduce(function(s,t){return s+t.amount;},0);var net=income-expenses;
  var today=isoDate(now);var todayMeals=meals.filter(function(m){return isoDate(m.date)===today;});
  var proteinMap={};todayMeals.forEach(function(m){proteinMap[m.memberName]=(proteinMap[m.memberName]||0)+(m.protein||0);});
  var proteinHits=members.filter(function(m){return(proteinMap[m.name]||0)>=50;}).length;
  var missing=members.filter(function(m){return!(proteinMap[m.name]>=50);}).map(function(m){return m.name;});
  var catTotals={};monthTxs.filter(function(t){return t.category!=='Income';}).forEach(function(t){catTotals[t.category]=(catTotals[t.category]||0)+t.amount;});
  var topCat=Object.keys(catTotals).sort(function(a,b){return catTotals[b]-catTotals[a];})[0]||'-';
  var avgDaily=now.getDate()>0?Math.round(expenses/Math.max(now.getDate(),1)):0;
  var goalsPct=goals.length?Math.round(goals.reduce(function(s,g){return s+(g.target>0?Math.min(g.current/g.target,1):0);},0)/goals.length*100):0;
  var weekSpend=[0,0,0,0,0,0,0];monthTxs.filter(function(t){return t.category!=='Income';}).forEach(function(t){var diff=Math.floor((now-toDate(t.date))/86400000);if(diff>=0&&diff<7)weekSpend[6-diff]+=t.amount;});
  var maxSp=Math.max.apply(null,weekSpend.concat([1]));var dayLabels=['S','M','T','W','T','F','S'];
  async function confirmTx(id){
    try{
      var tx=transactions.find(function(t){return t.id===id;});
      var{data,error}=await supabase.from('transactions').update({confirmed:true}).eq('id',id).select().single();
      console.log('[TX CONFIRM]',{id:id,data:data,error:error});
      if(error)throw error;
      upsertTransactionLocal(normTransactions([data])[0]);
      await refreshTransactions();
      haptic('medium');
      var todayISO=isoDate(new Date());
      var stillUnconf=transactions.filter(function(t){return t.id!==id && !t.confirmed && isoDate(t.date)===todayISO && (tx?t.memberId===tx.memberId:true);});
      if(stillUnconf.length===0 && tx){
        await recordScore(familyId,tx.memberId||'joint','all_tx_confirmed',20);
        await bumpStreak(familyId,tx.memberId||'joint','tx');
      }
    }catch(e){console.log('[TX CONFIRM ERROR]',e);haptic('error');showFriendlyError('Could not confirm transaction',e);}
  }
  var unconf=transactions.filter(function(t){return!t.confirmed;});
  var visibleTodayNudge=(todayNudge&&dismissedNudgeIds.indexOf(todayNudge.id)===-1)?todayNudge:null;
  var nudgeLabel=visibleTodayNudge?(visibleTodayNudge.domain==='finance'?'💡 Finance':visibleTodayNudge.domain==='wellness'?'🥗 Wellness':visibleTodayNudge.domain==='goals'?'🏺 Goals':'🏡 Family'):null;

  function runChecklistAction(item){
    if(!item||!item.tab)return;
    setQuickAction({action:item.action,mealType:item.mealType||null,nonce:Date.now()});
    navigation.navigate(item.tab);
  }

  // B4: Build the "Catch up from yesterday" checklist by looking at what was missing yesterday
  var yDate=new Date(now);yDate.setDate(yDate.getDate()-1);var yISO=isoDate(yDate);
  var yMeals=meals.filter(function(m){return isoDate(m.date)===yISO;});
  var yMealTypes={};yMeals.forEach(function(m){var t=(m.mealTime||'').toLowerCase();yMealTypes[t]=true;});
  var yWellness=wellness.filter(function(w){return w.date===yISO;});
  var yAnyWater=yWellness.some(function(w){return(w.water||0)>0;});
  var yAnyScreen=yWellness.some(function(w){return(w.screenHrs||0)>0;});
  var yUnconfirmed=transactions.filter(function(t){return!t.confirmed&&isoDate(t.date)===yISO;}).length;
  var catchup=[];
  if(yUnconfirmed>0)catchup.push({key:'tx',label:'Confirm '+yUnconfirmed+' entr'+(yUnconfirmed>1?'ies':'y'),tab:'Finance',action:'open_tx'});
  if(!yMealTypes.breakfast)catchup.push({key:'breakfast',label:'Note breakfast',tab:'Wellness',action:'open_meal',mealType:'breakfast'});
  if(!yMealTypes.lunch)catchup.push({key:'lunch',label:'Note lunch',tab:'Wellness',action:'open_meal',mealType:'lunch'});
  if(!yMealTypes.dinner)catchup.push({key:'dinner',label:'Note dinner',tab:'Wellness',action:'open_meal',mealType:'dinner'});
  if(!yAnyWater&&waterTrackingEnabled)catchup.push({key:'water',label:'Note water',tab:'Wellness',action:'open_water'});
  if(!yAnyScreen)catchup.push({key:'screen',label:'Note screen time',tab:'Wellness',action:'open_screen'});
  var isFirstLocalDay=userCreatedAt?isSameLocalDate(new Date(userCreatedAt),new Date()):false;
  var showCatchup=!isFirstLocalDay && catchup.length>0 && !catchupDismissed;

  var todaysMissing=todayStatus.missing||[];
  var isAllCaughtUp=!todayStatus.loading && todaysMissing.length===0;

  var todaysCompletion=calcDayCompletion(familyId,now,transactions,meals,wellness);
  var weeklyScores=[];
  for(var i=6;i>=0;i--){
    var d=addDays(now,-i);
    weeklyScores.push(calcDayCompletion(familyId,d,transactions,meals,wellness));
  }
  var prevWeekScores=[];
  for(var j=13;j>=7;j--){
    var d2=addDays(now,-j);
    prevWeekScores.push(calcDayCompletion(familyId,d2,transactions,meals,wellness));
  }
  var weeklyAvg=Math.round(weeklyScores.reduce(function(s,x){return s+x.percent;},0)/Math.max(weeklyScores.length,1));
  var prevWeeklyAvg=Math.round(prevWeekScores.reduce(function(s,x){return s+x.percent;},0)/Math.max(prevWeekScores.length,1));
  var weeklyTrend=weeklyAvg-prevWeeklyAvg;
  var streak=0;
  for(var k=0;k<90;k++){
    var d3=addDays(now,-k);
    var c=calcDayCompletion(familyId,d3,transactions,meals,wellness);
    if(c.percent===100)streak++;
    else break;
  }
  var bestDay=weeklyScores.slice().sort(function(a,b){return b.percent-a.percent;})[0]||weeklyScores[0];
  var worstDay=weeklyScores.slice().sort(function(a,b){return a.percent-b.percent;})[0]||weeklyScores[0];

  return(<View style={[z.scr,{paddingTop:ins.top,backgroundColor:theme.background}]}>
    <AddTxModal visible={showTx||!!editTx} onClose={function(){setShowTx(false);setEditTx(null);}} editTx={editTx}/>
    <DayDetailModal visible={showDayDetail} date={dayDetailDate} onClose={function(){setShowDayDetail(false);}} onChangeDate={setDayDetailDate} onEditTransaction={function(t){setShowDayDetail(false);setEditTx(t);}} onAddTransaction={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_tx',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Finance');}} onEditMeal={function(m){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_meal',mealType:(m.mealTime||'lunch'),initialDate:isoDate(m.date),editMealId:m.id,nonce:Date.now()});navigation.navigate('Wellness');}} onAddMeal={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_meal',mealType:'lunch',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}} onAddWater={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_water',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}} onAddScreen={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_screen',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}}/>
    <ScrollView style={z.fl} contentContainerStyle={z.pad} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.primary} colors={[theme.primary]}/>}
    >
    {/* Header */}
    <View style={[z.hdr,{paddingTop:12}]}>
      <View style={{flex:1}}>
        <TouchableOpacity onPress={function(){haptic('light');jumpToInsightsMonth();}} accessibilityRole="button">
          <Text style={[z.caps,{color:theme.muted,marginBottom:4}]}>{now.toLocaleString('en-IN',{month:'long',year:'numeric'})} {'\u203A'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={function(){haptic('light');navigation.navigate('Family');}} accessibilityRole="button">
          <Text style={[z.famNm,{color:theme.text,fontSize:24}]} numberOfLines={1}>{familyName||'Your Family'}</Text>
        </TouchableOpacity>
      </View>
      <View style={[z.row,{marginRight:8}]}>
        {members.slice(0,4).map(function(m,i){return<TouchableOpacity key={m.id} onPress={function(){haptic('light');setQuickAction&&setQuickAction({action:'focus_member',memberName:m.name,nonce:Date.now()});navigation.navigate('Family');}} style={[z.avS,{backgroundColor:SLOTS[i%5].bg,marginLeft:i?-8:0,zIndex:4-i,borderColor:theme.background}]} accessibilityLabel={m.name}><Text style={[z.avSTx,{color:SLOTS[i%5].text}]}>{(m.name||'?')[0]}</Text></TouchableOpacity>;})}
      </View>
      <TouchableOpacity onPress={function(){haptic('light');openSettings();}} style={{padding:6}}>
        <Text style={{fontSize:22,color:theme.textSecondary}}>{'\u2699'}</Text>
      </TouchableOpacity>
    </View>

    {/* Daily insight — the sentence is the first thing the eye lands on */}
    {visibleTodayNudge&&<TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');navigation.navigate('Insights');}} style={[z.nudge,{marginTop:8,marginBottom:6,backgroundColor:theme.accentLight,borderLeftColor:theme.accent}]}>
      <View style={[z.row,{justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}]}>
        <Text style={[z.cap,{color:theme.accent,textTransform:'uppercase',letterSpacing:0.6,fontWeight:'700'}]}>{nudgeLabel}</Text>
        <TouchableOpacity onPress={function(){dismissNudge&&dismissNudge(visibleTodayNudge.id);}}><Text style={[z.cap,{color:theme.accent,fontWeight:'600'}]}>Dismiss</Text></TouchableOpacity>
      </View>
      <Text style={[z.nudgeTx,{color:theme.text,fontSize:15,lineHeight:22}]}>{visibleTodayNudge.nudge_text}</Text>
    </TouchableOpacity>}

    {/* When there is no nudge yet, show a quiet, sentence-first welcome line so the screen never opens with a number */}
    {!visibleTodayNudge&&<View style={{marginTop:6,marginBottom:8,paddingHorizontal:4}}>
      <Text style={{fontSize:15,fontWeight:'500',color:theme.textSecondary,lineHeight:22}}>
        {members.length>1
          ?'Here is what your family looks like today.'
          :'Here is what today looks like for you and your family.'}
      </Text>
    </View>}

    {showCatchup&&<View style={[z.nudge,{backgroundColor:theme.accentLight,borderLeftColor:theme.accent}]}>
      <View style={[z.row,{justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}]}>
        <Text style={[z.txM,{color:theme.text,flex:1}]}>Yesterday wasn\u2019t fully captured</Text>
        <TouchableOpacity onPress={function(){setCatchupDismissed(true);}}><Text style={[z.cap,{color:theme.accent,fontWeight:'600'}]}>Dismiss</Text></TouchableOpacity>
      </View>
      {catchup.map(function(c){return<TouchableOpacity key={c.key} style={[z.row,{paddingVertical:6}]} onPress={function(){runChecklistAction(c);}}><View style={[z.checkbox,{borderColor:theme.accent}]}/><Text style={[z.body,{color:theme.text,flex:1}]}>{c.label}</Text><Text style={[z.cap,{color:theme.accent,fontWeight:'600'}]}>Open</Text></TouchableOpacity>;})}
    </View>}

    {/* Hero card — supporting context for the sentence above. Tapping the ₹ jumps to Finance. Protein number jumps to Wellness. Member-name in 'still short' jumps to that member's wellness focus. */}
    <View style={{borderRadius:20,backgroundColor:theme.primary,padding:20,marginTop:8,marginBottom:10}}>
      <Text style={{fontSize:11,fontWeight:'600',color:'rgba(255,255,255,0.7)',letterSpacing:1.2,textTransform:'uppercase',marginBottom:6}}>Your family this month</Text>
      <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');navigation.navigate('Finance');}}>
        <Text style={{fontSize:40,fontWeight:'700',color:'#FFFFFF',letterSpacing:-1,marginBottom:6}}>{'\u20B9'}{fmt(net)}</Text>
        <Text style={{fontSize:13,color:'rgba(255,255,255,0.78)'}}>{'\u20B9'}{fmt(income)} came in \u00b7 {'\u20B9'}{fmt(expenses)} went out</Text>
      </TouchableOpacity>
      <View style={{height:1,backgroundColor:'rgba(255,255,255,0.18)',marginVertical:14}}/>
      <View style={[z.row,{justifyContent:'space-between'}]}>
        <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');navigation.navigate('Wellness');}}>
          <Text style={{fontSize:11,fontWeight:'600',color:'rgba(255,255,255,0.7)',letterSpacing:0.6,textTransform:'uppercase',marginBottom:4}}>Protein today</Text>
          <Text style={{fontSize:18,fontWeight:'700',color:'#FFFFFF'}}>{proteinHits} of {members.length}</Text>
        </TouchableOpacity>
        <View style={{alignItems:'flex-end',flex:1,marginLeft:12,flexDirection:'row',flexWrap:'wrap',justifyContent:'flex-end'}}>
          {missing.length===0?
            <Text style={{fontSize:11,fontWeight:'500',color:'rgba(255,255,255,0.7)',textAlign:'right'}}>Everyone close \u2713</Text>
            :missing.map(function(name,i){return<TouchableOpacity key={name+i} onPress={function(){haptic('light');jumpProteinToMember(name);}} style={{marginLeft:6,marginBottom:4}}>
              <Text style={{fontSize:11,fontWeight:'600',color:'rgba(255,255,255,0.95)',textDecorationLine:'underline'}}>{name}{i<missing.length-1?',':''}</Text>
            </TouchableOpacity>;})}
          {missing.length>0&&<Text style={{fontSize:11,fontWeight:'500',color:'rgba(255,255,255,0.7)',marginLeft:6}}>still short</Text>}
        </View>
      </View>
    </View>

    {/* Stats strip — every tile is now tappable */}
    <View style={[z.strip,{marginTop:10,marginBottom:16}]}>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');jumpToInsightsThisWeek();}} style={[z.tile,{backgroundColor:theme.surfaceElevated}]}><Text style={[z.tileLbl,{color:theme.textSecondary}]}>Daily average</Text><Text style={[z.tileVal,{color:theme.text}]}>{'\u20B9'}{fmt(avgDaily)}</Text></TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){if(topCat&&topCat!=='-'){haptic('light');jumpToFinanceCategory(topCat);}}} style={[z.tile,{backgroundColor:theme.surfaceElevated}]}><Text style={[z.tileLbl,{color:theme.textSecondary}]}>Most went to</Text><Text style={[z.tileVal,{color:theme.text}]} numberOfLines={1}>{topCat}</Text></TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');navigation.navigate('Family');}} style={[z.tile,{backgroundColor:theme.surfaceElevated}]}><Text style={[z.tileLbl,{color:theme.textSecondary}]}>In your family</Text><Text style={[z.tileVal,{color:theme.text}]}>{members.length}</Text></TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setQuickAction&&setQuickAction({action:'focus_goals',nonce:Date.now()});navigation.navigate('Finance');}} style={[z.tile,{backgroundColor:theme.surfaceElevated}]}><Text style={[z.tileLbl,{color:theme.textSecondary}]}>Goal progress</Text><Text style={[z.tileVal,{color:theme.text}]}>{goalsPct}%</Text></TouchableOpacity>
    </View>

    {/* Today's snapshot — every card is now an entry-point */}
    <Sec>Today at a glance</Sec>
    <View style={{flexDirection:'row',gap:8,marginBottom:12}}>
      <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setShowTx(true);}} style={{flex:1,backgroundColor:theme.primaryLight,borderRadius:12,padding:14}}>
        <Text style={{fontSize:11,fontWeight:'600',color:theme.primary,letterSpacing:0.4,textTransform:'uppercase',marginBottom:6}}>Money</Text>
        <Text style={{fontSize:18,fontWeight:'700',color:theme.primary}}>{(transactions||[]).some(function(t){return isoDate(t.date)===isoDate(now);})?'\u2713':'\u2014'}</Text>
        <Text style={{fontSize:11,color:theme.textSecondary,marginTop:2}}>{(transactions||[]).filter(function(t){return isoDate(t.date)===isoDate(now);}).length} captured</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setQuickAction&&setQuickAction({action:'open_meal',mealType:'lunch',nonce:Date.now()});navigation.navigate('Wellness');}} style={{flex:1,backgroundColor:theme.primaryLight,borderRadius:12,padding:14}}>
        <Text style={{fontSize:11,fontWeight:'600',color:theme.primary,letterSpacing:0.4,textTransform:'uppercase',marginBottom:6}}>Meals</Text>
        <Text style={{fontSize:18,fontWeight:'700',color:theme.primary}}>{todayMeals.length}/3</Text>
        <Text style={{fontSize:11,color:theme.textSecondary,marginTop:2}}>captured</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setQuickAction&&setQuickAction({action:'open_screen',nonce:Date.now()});navigation.navigate('Wellness');}} style={{flex:1,backgroundColor:theme.primaryLight,borderRadius:12,padding:14}}>
        <Text style={{fontSize:11,fontWeight:'600',color:theme.primary,letterSpacing:0.4,textTransform:'uppercase',marginBottom:6}}>Screens</Text>
        <Text style={{fontSize:18,fontWeight:'700',color:theme.primary}}>{(wellness||[]).some(function(w){return w.date===isoDate(now)&&((w.screenHrs||0)>0||(w.screen_hrs||0)>0);})?'\u2713':'\u2014'}</Text>
        <Text style={{fontSize:11,color:theme.textSecondary,marginTop:2}}>today</Text>
      </TouchableOpacity>
    </View>

    <Sec>How this week is going</Sec>
    <View style={[z.card,{backgroundColor:theme.card,borderColor:theme.border}]}>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');jumpToInsightsThisWeek();}} style={[z.row,{justifyContent:'space-between',marginBottom:8}]}> 
        <Text style={[z.sub,{color:theme.textSecondary}]}>Today</Text>
        <Text style={[z.fv,{color:getCompletionColor(todaysCompletion.percent)}]}>{todaysCompletion.completed}/5 ({todaysCompletion.percent}%)</Text>
      </TouchableOpacity>
      <Bar pct={todaysCompletion.percent} color={getCompletionColor(todaysCompletion.percent)} h={8}/>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');jumpToInsightsThisWeek();}} style={[z.row,{justifyContent:'space-between',marginTop:10,marginBottom:6}]}> 
        <Text style={[z.sub,{color:theme.textSecondary}]}>Weekly average</Text>
        <Text style={[z.fv,{color:theme.text}]}>{weeklyAvg}% {weeklyTrend===0?'':weeklyTrend>0?'\u2191':'\u2193'}{weeklyTrend===0?'':Math.abs(weeklyTrend)+'%'}</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');jumpToInsightsThisWeek();}} style={[z.row,{justifyContent:'space-between',marginBottom:6}]}> 
        <Text style={[z.sub,{color:theme.textSecondary}]}>Days fully captured in a row</Text>
        <Text style={[z.fv,{color:theme.text}]}>{streak} day{streak===1?'':'s'}</Text>
      </TouchableOpacity>
      <View style={[z.row,{justifyContent:'space-between'}]}>
        <TouchableOpacity activeOpacity={0.7} onPress={function(){if(bestDay){haptic('light');openDayDetail(bestDay.date);}}}>
          <Text style={[z.cap,{color:theme.muted}]}>Strongest: {bestDay?bestDay.date:'-'}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={function(){if(worstDay){haptic('light');openDayDetail(worstDay.date);}}}>
          <Text style={[z.cap,{color:theme.muted}]}>Weakest: {worstDay?worstDay.date:'-'}</Text>
        </TouchableOpacity>
      </View>
    </View>

    {unconf.length>0&&<View><Sec>Waiting for you to confirm</Sec>{unconf.slice(0,5).map(function(t){return<SwipeableTxCard key={t.id} tx={t} onConfirm={function(){confirmTx(t.id);}} onEdit={function(){setEditTx(t);}}><View style={[z.card,{backgroundColor:theme.card,borderColor:theme.border}]}><View style={[z.row,{justifyContent:'space-between',marginBottom:8}]}><View style={{flex:1}}><Text style={[z.txM,{color:theme.text}]}>{t.merchant}</Text><Text style={[z.cap,{color:theme.muted}]}>{t.memberName||'Joint'}</Text></View><Text style={[z.txM,{color:theme.text}]}>{'\u20B9'}{fmt(t.amount)}</Text></View><View style={[z.row,{justifyContent:'space-between'}]}><Pill label={t.category||'Uncat'}/><View style={z.row}><TouchableOpacity onPress={function(){setEditTx(t);}} style={z.editBtn}><Text style={z.editTx}>{'\u270E'}</Text></TouchableOpacity><TouchableOpacity style={[z.bPri,{backgroundColor:theme.primary}]} onPress={function(){confirmTx(t.id);}}><Text style={z.bPriT}>Confirm</Text></TouchableOpacity></View></View></View></SwipeableTxCard>;})}<Text style={[z.cap,{textAlign:'center',marginTop:4,color:theme.muted}]}>Swipe right to confirm \u00b7 Swipe left to edit</Text></View>}
    {todayStatus.loading&&<View style={[z.card,{marginTop:16,backgroundColor:theme.card,borderColor:theme.border}]}><Text style={[z.cap,{color:theme.muted}]}>Looking at today\u2026</Text></View>}
    {checklistVisible&&isAllCaughtUp&&<View style={[z.ok,{marginTop:16,backgroundColor:theme.primaryLight}]}><Text style={[z.okTx,{color:theme.primary}]}>Today is fully captured \u2713</Text></View>}
    {checklistVisible&&!todayStatus.loading&&!isAllCaughtUp&&<View style={[z.nudge,{marginTop:16,backgroundColor:theme.accentLight,borderLeftColor:theme.accent}]}>
      <Text style={[z.txM,{color:theme.text,marginBottom:6}]}>Still pending today</Text>
      {todaysMissing.map(function(item){return<TouchableOpacity key={item.key} style={[z.row,{paddingVertical:6}]} onPress={function(){runChecklistAction(item);}}><View style={[z.checkbox,{borderColor:theme.accent}]}/><Text style={[z.body,{color:theme.text,flex:1}]}>{item.label}</Text><Text style={[z.cap,{color:theme.accent,fontWeight:'600'}]}>Open</Text></TouchableOpacity>;})}
    </View>}
    <TouchableOpacity style={[z.bPri,{alignSelf:'flex-start',marginTop:16,backgroundColor:theme.primary}]} onPress={function(){setShowTx(true);}}><Text style={z.bPriT}>+ Capture an entry</Text></TouchableOpacity>
    <Sec>The last seven days</Sec><View style={[z.card,{backgroundColor:theme.card,borderColor:theme.border}]}><View style={z.barRow}>{weekSpend.map(function(amt,i){
      var dayOffset=6-i;
      var barDate=addDays(now,-dayOffset);
      return<TouchableOpacity key={i} activeOpacity={0.7} onPress={function(){haptic('light');openDayDetail(barDate);}} style={z.barC}><View style={[z.bar,{height:Math.max((amt/maxSp)*80,4),backgroundColor:theme.primary}]}/><Text style={[z.barL,{color:theme.muted}]}>{dayLabels[(now.getDay()-6+i+7)%7]}</Text></TouchableOpacity>;
    })}</View><Text style={[z.note,{color:theme.textSecondary}]}>Total: {'\u20B9'}{fmt(weekSpend.reduce(function(a,b){return a+b;},0))}</Text></View>
    {transactions.length>0&&<View><Sec>Latest</Sec>{transactions.slice(0,5).map(function(t){return<TouchableOpacity key={t.id} style={[z.actR,{borderBottomColor:theme.border}]} onPress={function(){setEditTx(t);}}><View style={{flex:1}}><Text style={[z.actTx,{color:theme.text}]}>{t.memberName||'Joint'} {'\u20B9'}{fmt(t.amount)} {t.category}</Text><Text style={[z.cap,{color:theme.muted}]}>{t.merchant}</Text></View><Text style={[z.cap,{color:theme.muted}]}>{'\u270E'}</Text></TouchableOpacity>;})}</View>}
    {transactions.length===0&&<View style={[z.nudge,{marginTop:20,backgroundColor:theme.accentLight,borderLeftColor:theme.accent}]}><Text style={[z.nudgeTx,{color:theme.text}]}>Nothing captured yet. The first entry is the hardest.</Text></View>}
    <View style={{height:32}}/></ScrollView></View>);
}

// ═══════════════════════════════════════════════════════════════
// FINANCE SCREEN
// ═══════════════════════════════════════════════════════════════
function FinanceScreen(){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var navigation=useNavigation();
  var{familyId,familyName,members,userId,isAdmin,transactions,meals,wellness,goals,sharedGoals,recurringTransactions,transactionComments,quickAction,setQuickAction,refreshTransactions,upsertTransactionLocal,removeTransactionLocal,refreshRecurringTransactions,refreshSharedGoals,refreshSharedGoalContributions,refreshMeals,refreshWellness,logActivity,currentUserName}=useApp();
  var[showTx,setShowTx]=useState(false);var[showGoal,setShowGoal]=useState(false);var[editGoal,setEditGoal]=useState(null);var[showSharedGoalModal,setShowSharedGoalModal]=useState(false);var[activeSharedGoal,setActiveSharedGoal]=useState(null);var[goalContext,setGoalContext]=useState('Finance');
  var[editTx,setEditTx]=useState(null);
  var[selectedTxForComments,setSelectedTxForComments]=useState(null);
  var[searchText,setSearchText]=useState('');
  var[debouncedSearch,setDebouncedSearch]=useState('');
  var[showFilters,setShowFilters]=useState(false);
  var[showCalendar,setShowCalendar]=useState(false);
  var[calendarDate,setCalendarDate]=useState(new Date());
  var[showDayDetail,setShowDayDetail]=useState(false);
  var[dayDetailDate,setDayDetailDate]=useState(new Date());
  var[addTxDate,setAddTxDate]=useState(new Date());
  var[filters,setFilters]=useState({from:'',to:'',category:'',type:'all',min:'',max:''});
  var[catPickTx,setCatPickTx]=useState(null); // F14: tap a Pill → quick category change
  var[refreshing,setRefreshing]=useState(false);
  var[viewMonth,setViewMonth]=useState(new Date()); // F2: month picker
  var[showMonthPicker,setShowMonthPicker]=useState(false);
  var[goalQuickAdd,setGoalQuickAdd]=useState(null); // F18: long-press goal → quick contribute
  useEffect(function(){
    var t=setTimeout(function(){setDebouncedSearch(searchText);},250);
    return function(){clearTimeout(t);};
  },[searchText]);
  useEffect(function(){
    if(!quickAction||!quickAction.action)return;
    if(quickAction.action==='open_tx'){
      if(quickAction.initialDate)setAddTxDate(toDate(quickAction.initialDate));
      setShowTx(true);
      setQuickAction(null);
    }
    if(quickAction.action==='filter_category'&&quickAction.category){
      setFilters(function(f){return Object.assign({},f,{category:quickAction.category});});
      setQuickAction(null);
    }
    if(quickAction.action==='filter_income'){
      setFilters(function(f){return Object.assign({},f,{type:'income'});});
      setQuickAction(null);
    }
    if(quickAction.action==='focus_goals'){
      // No state change needed; goals section is below — caller already navigated here
      setQuickAction(null);
    }
  },[quickAction]);

  async function onPullRefresh(){
    setRefreshing(true);
    try{
      await Promise.all([
        refreshTransactions&&refreshTransactions(),
        refreshRecurringTransactions&&refreshRecurringTransactions(),
        refreshSharedGoals&&refreshSharedGoals(),
        refreshSharedGoalContributions&&refreshSharedGoalContributions(),
      ].filter(Boolean));
    }catch(e){console.log('[FINANCE PULL REFRESH ERROR]',e);}
    setRefreshing(false);
  }

  async function deleteTx(tx){
    if(!canModifyMemberData(isAdmin,members,userId,tx.memberId)){Alert.alert('Not allowed','You can only delete your own entries.');return;}
    Alert.alert('Delete transaction?','This will permanently remove this transaction.',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete',style:'destructive',onPress:async function(){
        try{
          removeTransactionLocal(tx.id);
          var{error}=await supabase.from('transactions').delete().eq('id',tx.id);
          if(error)throw error;
          await refreshTransactions();
          if(logActivity){await logActivity('transaction',{user_name:currentUserName||'Someone',action:'deleted',amount:tx.amount,category:tx.category,merchant:tx.merchant,transaction_type:tx.category==='Income'?'income':'expense'},tx.id,familyId);} 
          haptic('success');
        }catch(e){haptic('error');showFriendlyError('Could not delete transaction',e);await refreshTransactions();}
      }},
    ]);
  }

  async function deactivateRecurring(row){
    Alert.alert('Disable recurring entry?','This will stop future reminders for this transaction.',[
      {text:'Cancel',style:'cancel'},
      {text:'Disable',style:'destructive',onPress:async function(){
        try{
          var{error}=await supabase.from('recurring_transactions').update({is_active:false,updated_at:new Date().toISOString()}).eq('id',row.id);
          if(error)throw error;
          await refreshRecurringTransactions();
          haptic('success');
        }catch(e){haptic('error');showFriendlyError('Could not disable recurring entry',e);}
      }},
    ]);
  }

  async function confirmTransaction(tx){
    try{
      var{data,error}=await supabase.from('transactions').update({confirmed:true}).eq('id',tx.id).select().single();
      if(error)throw error;
      upsertTransactionLocal(normTransactions([data])[0]);
      await refreshTransactions();
      haptic('success');
    }catch(e){haptic('error');showFriendlyError('Could not confirm transaction',e);}
  }

  function applyFilters(rows){
    return (rows||[]).filter(function(t){
      var keep=true;
      if(debouncedSearch.trim()){
        keep=keep && String(t.merchant||'').toLowerCase().includes(debouncedSearch.trim().toLowerCase());
      }
      if(filters.category){keep=keep && t.category===filters.category;}
      if(filters.type&&filters.type!=='all'){
        keep=keep && ((filters.type==='income'&&t.category==='Income')||(filters.type==='expense'&&t.category!=='Income'));
      }
      if(filters.min){keep=keep && Number(t.amount)>=Number(filters.min||0);}
      if(filters.max){keep=keep && Number(t.amount)<=Number(filters.max||0);}
      if(filters.from){keep=keep && isoDate(t.date)>=filters.from;}
      if(filters.to){keep=keep && isoDate(t.date)<=filters.to;}
      return keep;
    });
  }

  var now=new Date();
  function isInViewMonth(d){var dt=toDate(d);return dt.getMonth()===viewMonth.getMonth()&&dt.getFullYear()===viewMonth.getFullYear();}
  var categoryFilterOptions=CAT_LIST.slice();
  var monthTxs=transactions.filter(function(t){return isInViewMonth(t.date);});
  var income=monthTxs.filter(function(t){return t.category==='Income';}).reduce(function(s,t){return s+t.amount;},0);
  var expenses=monthTxs.filter(function(t){return t.category!=='Income';}).reduce(function(s,t){return s+t.amount;},0);
  var savings=income-expenses;var savePct=income>0?Math.round((savings/income)*100):0;
  var catData={};categoryFilterOptions.forEach(function(c){catData[c]=0;});monthTxs.filter(function(t){return t.category!=='Income';}).forEach(function(t){catData[t.category]=(catData[t.category]||0)+t.amount;});
  var filteredMonthTxs=applyFilters(monthTxs);
  var financeGoals=(goals||[]).filter(function(g){return String(g.category||'').toLowerCase()!=='health'&&String(g.category||'').toLowerCase()!=='protein'&&String(g.category||'').toLowerCase()!=='hydration'&&String(g.category||'').toLowerCase()!=='sleep'&&String(g.category||'').toLowerCase()!=='screen time';});
  var financeSharedGoals=(sharedGoals||[]).filter(function(g){return String(g.category||'').toLowerCase()!=='health'&&String(g.category||'').toLowerCase()!=='protein'&&String(g.category||'').toLowerCase()!=='hydration'&&String(g.category||'').toLowerCase()!=='sleep'&&String(g.category||'').toLowerCase()!=='screen time';});
  var unconfirmedRecurringTx=filteredMonthTxs.filter(function(t){return !t.confirmed && !!t.recurring_transaction_id;});
  var activeFilters=[];
  if(filters.from)activeFilters.push('From '+filters.from);
  if(filters.to)activeFilters.push('To '+filters.to);
  if(filters.category)activeFilters.push(filters.category);
  if(filters.type&&filters.type!=='all')activeFilters.push(filters.type);
  if(filters.min)activeFilters.push('Min ₹'+filters.min);
  if(filters.max)activeFilters.push('Max ₹'+filters.max);
  if(debouncedSearch.trim())activeFilters.push('Search: '+debouncedSearch.trim());

  return(<View style={[z.scr,{paddingTop:ins.top,backgroundColor:theme.background}]}> 
    <AddTxModal visible={showTx||!!editTx} onClose={function(){setShowTx(false);setEditTx(null);}} editTx={editTx} initialDate={addTxDate}/>
    <TransactionCommentsModal visible={!!selectedTxForComments} onClose={function(){setSelectedTxForComments(null);}} transaction={selectedTxForComments}/>
    <UnifiedCalendarModal visible={showCalendar} onClose={function(){setShowCalendar(false);}} context="finance" selectedDate={calendarDate} onSelectDate={setCalendarDate} onOpenDayDetail={function(d){setCalendarDate(d);setDayDetailDate(d);setShowDayDetail(true);}}/>
    <DayDetailModal visible={showDayDetail} date={dayDetailDate} onClose={function(){setShowDayDetail(false);}} onChangeDate={setDayDetailDate} onEditTransaction={function(t){setShowDayDetail(false);setEditTx(t);}} onAddTransaction={function(d){setShowDayDetail(false);setAddTxDate(d);setShowTx(true);}} onAddMeal={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_meal',mealType:'lunch',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}} onAddWater={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_water',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}} onAddScreen={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_screen',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}}/>
    <AddGoalModal visible={showGoal} onClose={function(){setShowGoal(false);}} defaultGoalType="personal" defaultCategory={goalContext==='Wellness'?'Health':'Savings'} contextLabel={goalContext}/>{editGoal&&<EditGoalModal visible={true} onClose={function(){setEditGoal(null);}} goal={editGoal} familyId={familyId}/>}
    <SharedGoalModal visible={showSharedGoalModal} onClose={function(){setShowSharedGoalModal(false);setActiveSharedGoal(null);}} goal={activeSharedGoal}/> 
    <CategoryQuickPickModal visible={!!catPickTx} onClose={function(){setCatPickTx(null);}} transaction={catPickTx}/>
    <SharedGoalContributionModal visible={!!goalQuickAdd&&goalQuickAdd.kind==='shared'} onClose={function(){setGoalQuickAdd(null);}} goal={goalQuickAdd&&goalQuickAdd.kind==='shared'?goalQuickAdd.raw:null}/>
    {showMonthPicker&&<Modal visible={true} transparent animationType="fade" onRequestClose={function(){setShowMonthPicker(false);}}><View style={[z.modalWrap,{justifyContent:'center'}]}><View style={[z.modal,{margin:20,maxHeight:380}]}>
      <Text style={z.h1}>Choose month</Text>
      <ScrollView style={{maxHeight:280}}>
        {(function(){var arr=[];for(var i=0;i<24;i++){arr.push(addDays(new Date(now.getFullYear(),now.getMonth(),1),-1*i*30));}return arr.map(function(_,i){var d=new Date(now.getFullYear(),now.getMonth()-i,1);var sel=d.getMonth()===viewMonth.getMonth()&&d.getFullYear()===viewMonth.getFullYear();return<TouchableOpacity key={'m'+i} onPress={function(){haptic('light');setViewMonth(d);setShowMonthPicker(false);}} style={[z.card,{marginBottom:6,backgroundColor:sel?theme.primaryLight:theme.surface}]}><Text style={[z.txM,{color:sel?theme.primary:theme.text}]}>{d.toLocaleString('en-IN',{month:'long',year:'numeric'})}</Text></TouchableOpacity>;});})()}
      </ScrollView>
      <TouchableOpacity style={[z.bSec,{borderColor:theme.primary,marginTop:8}]} onPress={function(){setShowMonthPicker(false);}}><Text style={[z.bSecT,{color:theme.primary}]}>Close</Text></TouchableOpacity>
    </View></View></Modal>}

    {showFilters&&<Modal visible={true} transparent animationType="slide"><View style={z.modalWrap}><View style={z.modal}><ScrollView>
      <Text style={z.h1}>Filters</Text>
      <Inp label="From date (YYYY-MM-DD)" value={filters.from} onChangeText={function(v){setFilters(Object.assign({},filters,{from:v}));}} placeholder="2026-04-01"/>
      <Inp label="To date (YYYY-MM-DD)" value={filters.to} onChangeText={function(v){setFilters(Object.assign({},filters,{to:v}));}} placeholder="2026-04-30"/>
      <Text style={z.inpLabel}>Type</Text>
      <View style={[z.row,{gap:8,marginBottom:12}]}>{['all','income','expense'].map(function(tp){var sel=filters.type===tp;return<TouchableOpacity key={tp} style={[z.chip,sel&&z.chipSel]} onPress={function(){setFilters(Object.assign({},filters,{type:tp}));}}><Text style={[z.chipTx,sel&&z.chipSelTx]}>{tp}</Text></TouchableOpacity>;})}</View>
      <Text style={z.inpLabel}>Category</Text>
      <View style={[z.row,{flexWrap:'wrap',gap:8,marginBottom:12}]}> 
        <TouchableOpacity style={[z.chip,!filters.category&&z.chipSel]} onPress={function(){setFilters(Object.assign({},filters,{category:''}));}}><Text style={[z.chipTx,!filters.category&&z.chipSelTx]}>All</Text></TouchableOpacity>
        {categoryFilterOptions.map(function(c){var sel=filters.category===c;return<TouchableOpacity key={c} style={[z.chip,sel&&z.chipSel]} onPress={function(){setFilters(Object.assign({},filters,{category:c}));}}><Text style={[z.chipTx,sel&&z.chipSelTx]}>{c}</Text></TouchableOpacity>;})}
      </View>
      <View style={[z.row,{gap:8}]}> 
        <View style={{flex:1}}><Inp label="Min amount" value={filters.min} onChangeText={function(v){setFilters(Object.assign({},filters,{min:v}));}} keyboardType="numeric"/></View>
        <View style={{flex:1}}><Inp label="Max amount" value={filters.max} onChangeText={function(v){setFilters(Object.assign({},filters,{max:v}));}} keyboardType="numeric"/></View>
      </View>
      <View style={z.row}><TouchableOpacity style={[z.bSec,{flex:1,marginRight:8}]} onPress={function(){setFilters({from:'',to:'',category:'',type:'all',min:'',max:''});}}><Text style={z.bSecT}>Clear all</Text></TouchableOpacity><TouchableOpacity style={[z.bPri,{flex:1}]} onPress={function(){setShowFilters(false);}}><Text style={z.bPriT}>Apply</Text></TouchableOpacity></View>
    </ScrollView></View></View></Modal>}

    <ScrollView style={z.fl} contentContainerStyle={z.pad} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.primary} colors={[theme.primary]}/>}
    >
    <View style={[z.row,{justifyContent:'space-between',alignItems:'flex-start',paddingTop:8,marginBottom:6}]}>
      <View style={{flex:1}}>
        <Text style={[z.h1,{color:theme.text}]}>Finance</Text>
        <TouchableOpacity onPress={function(){haptic('light');setShowMonthPicker(true);}} accessibilityRole="button">
          <Text style={[z.caps,{color:theme.muted,marginTop:4}]}>{viewMonth.toLocaleString('en-IN',{month:'long',year:'numeric'})} {'\u203A'}</Text>
        </TouchableOpacity>
      </View>
      <View style={[z.row,{gap:8}]}>
        <TouchableOpacity style={{width:42,height:42,borderRadius:12,borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface,alignItems:'center',justifyContent:'center'}} onPress={function(){setShowCalendar(true);}}>
          <Text style={{fontSize:18}}>{'\uD83D\uDCC5'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[z.bSec,{borderColor:theme.primary,paddingHorizontal:14}]} onPress={function(){setShowFilters(true);}}>
          <Text style={[z.bSecT,{color:theme.primary}]}>Filters</Text>
        </TouchableOpacity>
      </View>
    </View>

    <View style={{borderRadius:20,backgroundColor:theme.primary,padding:20,marginTop:12,marginBottom:14}}>
      <Text style={{fontSize:11,fontWeight:'600',color:'rgba(255,255,255,0.7)',letterSpacing:1.2,textTransform:'uppercase',marginBottom:6}}>Spent this month</Text>
      <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setQuickAction&&setQuickAction({action:'focus_month',nonce:Date.now()});navigation.navigate('Insights');}}>
        <Text style={{fontSize:40,fontWeight:'700',color:'#FFFFFF',letterSpacing:-1,marginBottom:14}}>{'\u20B9'}{fmt(expenses)}</Text>
      </TouchableOpacity>
      <View style={{flexDirection:'row',gap:10}}>
        <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setFilters(Object.assign({},filters,{type:'income'}));}} style={{flex:1,backgroundColor:'rgba(255,255,255,0.12)',borderRadius:12,padding:12}}>
          <Text style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginBottom:4}}>Came in</Text>
          <Text style={{fontSize:16,fontWeight:'700',color:'#FFFFFF'}}>{'\u20B9'}{fmt(income)}</Text>
        </TouchableOpacity>
        <View style={{flex:1,backgroundColor:'rgba(255,255,255,0.12)',borderRadius:12,padding:12}}>
          <Text style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginBottom:4}}>Kept</Text>
          <Text style={{fontSize:16,fontWeight:'700',color:savings>=0?'#FFFFFF':'#FFD0D0'}}>{'\u20B9'}{fmt(savings)}</Text>
          <Text style={{fontSize:10,color:'rgba(255,255,255,0.7)',marginTop:2}}>{savePct}%</Text>
        </View>
      </View>
    </View>

    {income===0&&<View style={[z.nudge,{backgroundColor:theme.accentLight,borderLeftColor:theme.accent}]}><Text style={[z.nudgeTx,{color:theme.text}]}>Add what came in first to see what your family kept.</Text></View>}
    <View style={[z.row,{gap:8,marginTop:6}]}><TouchableOpacity style={[z.bPri,{flex:1,backgroundColor:theme.primary}]} onPress={function(){setShowTx(true);}}><Text style={z.bPriT}>+ Capture expense or income</Text></TouchableOpacity></View>
    {unconfirmedRecurringTx.length>0&&<View style={[z.nudge,{marginTop:10,backgroundColor:theme.accentLight,borderLeftColor:theme.accent}]}> 
      <Text style={[z.txM,{color:theme.text,marginBottom:6}]}>These usually happen \u2014 confirm if they did</Text>
      {unconfirmedRecurringTx.slice(0,5).map(function(t){return <View key={t.id} style={[z.row,{justifyContent:'space-between',alignItems:'center',marginBottom:6}]}> 
        <View style={{flex:1,paddingRight:8}}><Text style={[z.body,{color:theme.text}]}>{t.merchant}</Text><Text style={[z.cap,{color:theme.muted}]}>{displayDate(t.date)} \u00b7 {'\u20B9'}{fmt(t.amount)}</Text></View>
        <View style={z.row}><TouchableOpacity style={[z.bSec,{borderColor:theme.primary,paddingHorizontal:10,paddingVertical:6,marginRight:6}]} onPress={function(){setEditTx(t);}}><Text style={[z.bSecT,{color:theme.primary}]}>Edit</Text></TouchableOpacity><TouchableOpacity style={[z.bPri,{backgroundColor:theme.primary,paddingHorizontal:10,paddingVertical:6}]} onPress={function(){confirmTransaction(t);}}><Text style={z.bPriT}>Confirm</Text></TouchableOpacity></View>
      </View>;})}
    </View>}
    <Inp label="Search entries" value={searchText} onChangeText={setSearchText} placeholder="Search by what or where"/>
    {activeFilters.length>0&&<View style={[z.row,{flexWrap:'wrap',gap:6,marginBottom:8}]}>{activeFilters.map(function(f){return<TouchableOpacity key={f} onPress={function(){haptic('light');
      // F23: tap a filter chip to remove that single filter
      var nextFilters=Object.assign({},filters);
      if(f==='From '+filters.from)nextFilters.from='';
      else if(f==='To '+filters.to)nextFilters.to='';
      else if(f===filters.category)nextFilters.category='';
      else if(f===filters.type)nextFilters.type='all';
      else if(f==='Min \u20B9'+filters.min)nextFilters.min='';
      else if(f==='Max \u20B9'+filters.max)nextFilters.max='';
      else if(f==='Search: '+debouncedSearch.trim()){setSearchText('');setDebouncedSearch('');return;}
      setFilters(nextFilters);
    }} style={z.filterChip}><Text style={z.filterChipTx}>{f} \u00d7</Text></TouchableOpacity>;})}</View>}
    <Text style={[z.cap,{marginBottom:8}]}>Showing {filteredMonthTxs.length} of {monthTxs.length} entries</Text>

    <Sec>Where the money went</Sec>{categoryFilterOptions.map(function(c){var amt=catData[c]||0;var pct=expenses>0?Math.round((amt/expenses)*100):0;return<TouchableOpacity key={c} activeOpacity={0.7} onPress={function(){haptic('light');setFilters(Object.assign({},filters,{category:filters.category===c?'':c}));}} style={[z.card,{marginBottom:8,backgroundColor:filters.category===c?theme.primaryLight:theme.card,borderColor:filters.category===c?theme.primary:theme.border}]}><View style={[z.row,{justifyContent:'space-between',marginBottom:6}]}><Text style={z.txM}>{c}</Text><View style={z.row}><Text style={[z.fv,{marginRight:8}]}>{'₹'}{fmt(amt)}</Text><View style={[z.pctB,{backgroundColor:(CAT_COLORS[c]||'#555')+'18'}]}><Text style={[z.pctT,{color:CAT_COLORS[c]||'#555'}]}>{pct}%</Text></View></View></View><Bar pct={pct} color={CAT_COLORS[c]||'#777'}/></TouchableOpacity>;})}

    <Sec>This month\u2019s entries</Sec>{filteredMonthTxs.slice(0,25).map(function(t){var commentCount=(transactionComments||[]).filter(function(c){return c.transaction_id===t.id;}).length;return<View key={t.id} style={z.txRow}><TouchableOpacity style={{flex:1}} onPress={function(){if(canModifyMemberData(isAdmin,members,userId,t.memberId)){setEditTx(t);} else Alert.alert('Read only','Only admin can edit other member entries.');}}><Text style={[z.body,{flex:1}]}>{t.merchant}</Text><Text style={z.cap}>{displayDate(t.date)} · {t.memberName||'Joint'}</Text></TouchableOpacity><Text style={[z.fv,{marginRight:8}]}>{'₹'}{fmt(t.amount)}</Text>{t.is_family_spending&&<Text style={[z.cap,{color:'#0F6E56',marginRight:6}]}>👨‍👩‍👧 Family</Text>}<TouchableOpacity onPress={function(){if(canModifyMemberData(isAdmin,members,userId,t.memberId)){haptic('light');setCatPickTx(t);} else Alert.alert('Read only','Only admin can change other member entries.');}}><Pill label={t.category||'Uncat'}/></TouchableOpacity><TouchableOpacity onPress={function(){setSelectedTxForComments(t);}} style={z.editBtn}><Text style={z.editTx}>💬</Text>{commentCount>0&&<View style={z.commentCountBadge}><Text style={z.commentCountTx}>{commentCount}</Text></View>}</TouchableOpacity><TouchableOpacity onPress={function(){if(canModifyMemberData(isAdmin,members,userId,t.memberId)){setEditTx(t);} else Alert.alert('Read only','Only admin can edit other member entries.');}} style={z.editBtn}><Text style={z.editTx}>✎</Text></TouchableOpacity><TouchableOpacity onPress={function(){deleteTx(t);}} style={z.editBtn}><Text style={[z.editTx,{color:'#E24B4A'}]}>🗑</Text></TouchableOpacity></View>;})}
    {filteredMonthTxs.length===0&&<Text style={z.cap}>Nothing matches those filters.</Text>}
    <Sec>What you\u2019re building toward</Sec>{[].concat((financeGoals||[]).map(function(g){var gt=(g.goal_type||((g.is_shared||g.goal_scope==='shared')?'shared':'personal'));return{kind:gt==='shared'?'shared':'personal',id:g.id,name:g.name,current:Number(g.current||0),target:Number(g.target||0),category:g.category||'General',raw:g,source:'goals'};}),(financeSharedGoals||[]).map(function(g){return{kind:'shared',id:g.id,name:g.goal_name,current:Number(g.current_amount||0),target:Number(g.target_amount||0),category:g.category||'General',raw:g,source:'shared_goals'};})).map(function(g){var pct=g.target>0?Math.round((g.current/g.target)*100):0;return<TouchableOpacity key={g.kind+'-'+g.source+'-'+g.id} style={[z.card,{marginBottom:8}]} onPress={function(){if(g.kind==='personal'){setEditGoal(g.raw);}else{setActiveSharedGoal(g.raw);setShowSharedGoalModal(true);}}} onLongPress={function(){if(g.kind==='shared'){haptic('medium');setGoalQuickAdd(g);}}} delayLongPress={350}><View style={[z.row,{justifyContent:'space-between',alignItems:'center'}]}><View style={{flex:1,paddingRight:8}}><View style={[z.row,{alignItems:'center',flexWrap:'wrap'}]}><Text style={z.txM}>{g.name}</Text>{g.kind==='shared'&&<View style={z.goalFamilyBadge}><Text style={z.goalFamilyBadgeTx}>Family</Text></View>}{g.kind==='personal'&&<View style={[z.goalFamilyBadge,{backgroundColor:'#F2F2EE'}]}><Text style={[z.goalFamilyBadgeTx,{color:'#555'}]}>Personal</Text></View>}</View><Text style={[z.cap,{marginTop:4}]}>{g.category||'General'}</Text></View><Text style={[z.fv,{color:g.kind==='shared'?'#0F6E56':'#BA7517'}]}>{Math.min(pct,999)}%</Text></View><Text style={[z.cap,{marginVertical:6}]}>{fmt(g.current)} / {fmt(g.target)} progress</Text><Bar pct={Math.min(pct,100)} color={g.kind==='shared'?'#0F6E56':'#EF9F27'}/><Text style={[z.cap,{marginTop:4}]}>{g.kind==='shared'?'Tap to edit \u00b7 Long-press to add a contribution':'Tap to edit goal'}</Text></TouchableOpacity>;})}
    {((financeGoals||[]).length===0&&(financeSharedGoals||[]).length===0)&&<Text style={z.cap}>No money goals yet. The first one starts below.</Text>}
    <TouchableOpacity style={[z.bPri,{alignSelf:'flex-start'}]} onPress={function(){setGoalContext('Finance');setShowGoal(true);}}><Text style={z.bPriT}>+ New money goal</Text></TouchableOpacity>

    <Sec>Repeating entries</Sec>
    {(recurringTransactions||[]).map(function(r){
      var days=Math.floor((startOfDay(r.next_due_date)-startOfDay(new Date()))/86400000);
      var dueSoon=days>=0&&days<=7;
      return <TouchableOpacity key={r.id} activeOpacity={0.7} onPress={function(){
        // F19: tap row \u2192 open the related transaction edit if one exists; otherwise open new tx prefilled with the recurring info
        var related=(transactions||[]).find(function(t){return t.recurring_transaction_id===r.id;});
        if(related){setEditTx(related);}
        else{
          var stub={id:null,merchant:r.description,amount:r.amount,category:r.category||'',date:r.next_due_date,recurring_transaction_id:r.id};
          setEditTx(stub);
        }
      }} style={[z.card,{marginBottom:8,borderColor:dueSoon?'#BA7517':'#E0E0DB'}]}> 
      <View style={[z.row,{justifyContent:'space-between'}]}><Text style={z.txM}>{r.description}</Text><Text style={z.fv}>₹{fmt(r.amount)}</Text></View>
      <Text style={z.cap}>{r.transaction_type} · {r.frequency} · Next due {displayDate(r.next_due_date)}</Text>
      {dueSoon&&<Text style={[z.cap,{color:'#BA7517',marginTop:4,fontWeight:'500'}]}>Due in {days} day{days===1?'':'s'}</Text>}
      <TouchableOpacity style={{marginTop:8,alignSelf:'flex-start'}} onPress={function(){deactivateRecurring(r);}}><Text style={[z.cap,{color:'#E24B4A',fontWeight:'500'}]}>Disable</Text></TouchableOpacity>
    </TouchableOpacity>;})}
    {(!recurringTransactions||recurringTransactions.length===0)&&<Text style={z.cap}>No recurring entries yet. Enable it when adding a transaction.</Text>}
    <View style={{height:32}}/></ScrollView></View>);
}

// ═══════════════════════════════════════════════════════════════
// WELLNESS SCREEN
// ═══════════════════════════════════════════════════════════════
function WellnessScreen(){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var navigation=useNavigation();
  var{familyId,members,userId,isAdmin,meals,wellness,goals,memberProfiles,userProfile,quickAction,setQuickAction,refreshMeals,refreshWellness,refreshTransactions,removeMealLocal,removeWellnessLocal,logActivity,currentUserName,waterTrackingEnabled,scores,streaks,transactions}=useApp();
  var[showMeal,setShowMeal]=useState(false);
  var[editMeal,setEditMeal]=useState(null); // B2
  var[showWater,setShowWater]=useState(false); // B3
  var[showScreen,setShowScreen]=useState(false); // B3
  var[showCalendar,setShowCalendar]=useState(false);
  var[calendarDate,setCalendarDate]=useState(new Date());
  var[showDayDetail,setShowDayDetail]=useState(false);
  var[dayDetailDate,setDayDetailDate]=useState(new Date());
  var[showGoal,setShowGoal]=useState(false);
  var[editGoal,setEditGoal]=useState(null);
  var[initialMealType,setInitialMealType]=useState('lunch');
  var[mealDate,setMealDate]=useState(new Date());
  var[waterDate,setWaterDate]=useState(new Date());
  var[screenDate,setScreenDate]=useState(new Date());
  var[memberFilterId,setMemberFilterId]=useState(null); // W1: filter by member
  var[memberDetail,setMemberDetail]=useState(null); // W4/W6 sheet
  var[refreshing,setRefreshing]=useState(false);
  var memberFilterRef=React.useRef(null);
  useEffect(function(){
    if(!quickAction||!quickAction.action)return;
    if(quickAction.action==='open_meal'){
      setInitialMealType(quickAction.mealType||'lunch');
      if(quickAction.initialDate)setMealDate(toDate(quickAction.initialDate));
      setShowMeal(true);
      setQuickAction(null);
    }
    if(quickAction.action==='open_water'){
      if(quickAction.initialDate)setWaterDate(toDate(quickAction.initialDate));
      setShowWater(true);
      setQuickAction(null);
    }
    if(quickAction.action==='open_screen'){
      if(quickAction.initialDate)setScreenDate(toDate(quickAction.initialDate));
      setShowScreen(true);
      setQuickAction(null);
    }
    if(quickAction.action==='focus_member'&&quickAction.memberName){
      var match=(members||[]).find(function(m){return m.name===quickAction.memberName;});
      if(match)setMemberFilterId(match.id);
      setQuickAction(null);
    }
  },[quickAction,members]);

  async function onPullRefresh(){
    setRefreshing(true);
    try{
      await Promise.all([
        refreshMeals&&refreshMeals(),
        refreshWellness&&refreshWellness(),
        refreshTransactions&&refreshTransactions(),
      ].filter(Boolean));
    }catch(e){console.log('[WELLNESS PULL REFRESH ERROR]',e);}
    setRefreshing(false);
  }
  async function deleteMeal(meal){
    if(!canModifyMemberData(isAdmin,members,userId,meal.memberId)){Alert.alert('Not allowed','You can only delete your own logs.');return;}
    Alert.alert('Delete meal log?','This will permanently remove this meal entry.',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete',style:'destructive',onPress:async function(){
        try{
          removeMealLocal(meal.id);
          var{error}=await supabase.from('meals').delete().eq('id',meal.id);
          if(error)throw error;
          await refreshMeals();
          if(logActivity){await logActivity('meal',{user_name:currentUserName||'Someone',action:'deleted',meal_time:meal.mealTime,member_name:meal.memberName||''},meal.id,familyId);} 
          haptic('success');
        }catch(e){haptic('error');showFriendlyError('Could not delete meal log',e);await refreshMeals();}
      }},
    ]);
  }
  async function deleteWellnessRow(row){
    if(!canModifyMemberData(isAdmin,members,userId,row.memberId)){Alert.alert('Not allowed','You can only delete your own logs.');return;}
    Alert.alert('Delete wellness log?','This will delete both water and screen time for this member on this date.',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete',style:'destructive',onPress:async function(){
        try{
          removeWellnessLocal(row.memberId,row.date);
          var{error}=await supabase.from('wellness').delete().eq('family_id',familyId).eq('member_id',row.memberId).eq('date',row.date);
          if(error)throw error;
          await refreshWellness();
          if(logActivity){await logActivity('wellness',{user_name:currentUserName||'Someone',action:'deleted',log_type:'wellness',member_name:row.memberName||'',date:row.date},row.id||null,familyId);} 
          haptic('success');
        }catch(e){haptic('error');showFriendlyError('Could not delete wellness log',e);await refreshWellness();}
      }},
    ]);
  }
  var today=isoDate(new Date());var todayMeals=meals.filter(function(m){return isoDate(m.date)===today;});
  var proteinMapByMemberId={};todayMeals.forEach(function(m){var key=m.memberId||m.member_id||('name_'+(m.memberName||m.member_name||''));proteinMapByMemberId[key]=(proteinMapByMemberId[key]||0)+(Number(m.protein)||0);});
  var todayW=wellness.filter(function(w){return w.date===today;});var totalWaterLitres=todayW.reduce(function(s,w){return s+(Number(w.water)||0);},0);
  var perMemberTargets=(members||[]).map(function(m){
    var profile=(memberProfiles&&m.userId)?memberProfiles[m.userId]:null;
    var targets=calculateProteinTargets(profile&&profile.weightKg?profile.weightKg:null);
    var target=targets.active;
    var proteinKey=m.id||('name_'+m.name);
    var consumed=proteinMapByMemberId[proteinKey]||proteinMapByMemberId['name_'+m.name]||0;
    var wellRow=todayW.find(function(w){return (w.memberId||w.member_id)===m.id;})||todayW.find(function(w){return w.memberName===m.name;});
    return{member:m,target:target,targets:targets,protein:consumed,wellnessRow:wellRow};
  });
  var currentUserMember=(members||[]).find(function(m){return m.userId===userId;})||null;
  var currentUserMemberProfile=(currentUserMember&&memberProfiles)?memberProfiles[currentUserMember.userId]:null;
  var currentUserWeightKg=parseWeightKg(userProfile&&userProfile.weight,userProfile&&userProfile.weight_unit)||(currentUserMemberProfile&&currentUserMemberProfile.weightKg)||null;
  var currentUserProteinTargets=calculateProteinTargets(currentUserWeightKg);
  var todayProteinForCurrentUser=currentUserMember?(proteinMapByMemberId[currentUserMember.id]||proteinMapByMemberId['name_'+currentUserMember.name]||0):0;
  var totalProtein=perMemberTargets.reduce(function(sum,x){return sum+x.protein;},0);
  var totalProteinTarget=perMemberTargets.reduce(function(sum,x){return sum+x.target;},0);
  var wellnessGoals=(goals||[]).filter(function(g){var c=String(g.category||'').toLowerCase();return c==='health'||c==='protein'||c==='hydration'||c==='sleep'||c==='screen time';});
  return(<View style={[z.scr,{paddingTop:ins.top,backgroundColor:theme.background}]}>
    <AddMealModal visible={showMeal||!!editMeal} onClose={function(){setShowMeal(false);setEditMeal(null);setInitialMealType('lunch');}} editMeal={editMeal} initialMealType={initialMealType} initialDate={mealDate}/>
    <UnifiedCalendarModal visible={showCalendar} onClose={function(){setShowCalendar(false);}} context="wellness" selectedDate={calendarDate} onSelectDate={setCalendarDate} onOpenDayDetail={function(d){setCalendarDate(d);setDayDetailDate(d);setShowDayDetail(true);}}/>
    <DayDetailModal visible={showDayDetail} date={dayDetailDate} onClose={function(){setShowDayDetail(false);}} onChangeDate={setDayDetailDate} onEditMeal={function(m){setShowDayDetail(false);setEditMeal(m);setMealDate(toDate(m.date));}} onAddMeal={function(d){setShowDayDetail(false);setMealDate(d);setShowMeal(true);}} onAddWater={function(d){setShowDayDetail(false);setWaterDate(d);setShowWater(true);}} onAddScreen={function(d){setShowDayDetail(false);setScreenDate(d);setShowScreen(true);}} onAddTransaction={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_tx',initialDate:isoDate(d),nonce:Date.now()});}}/>
    <LogWaterModal visible={showWater} onClose={function(){setShowWater(false);}} initialDate={waterDate}/>
    <LogScreenTimeModal visible={showScreen} onClose={function(){setShowScreen(false);}} initialDate={screenDate}/>
    <AddGoalModal visible={showGoal} onClose={function(){setShowGoal(false);}} defaultGoalType="personal" defaultCategory="Health" contextLabel="Wellness"/>
    {editGoal&&<EditGoalModal visible={true} onClose={function(){setEditGoal(null);}} goal={editGoal} familyId={familyId}/>}
    <MemberDetailModal visible={!!memberDetail} member={memberDetail} onClose={function(){setMemberDetail(null);}}
      onJumpProtein={function(m){setMemberDetail(null);setMemberFilterId(m.id);}}
      onJumpScreens={function(m){setMemberDetail(null);setMemberFilterId(m.id);}}
      onJumpStreak={function(m){setMemberDetail(null);navigation.navigate('Family');}}
      onJumpScoreBreakdown={function(m){setMemberDetail(null);navigation.navigate('Family');}}
      onJumpToday={function(m){setMemberDetail(null);setMemberFilterId(m.id);}}
    />
    <ScrollView style={z.fl} contentContainerStyle={z.pad} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.primary} colors={[theme.primary]}/>}
    >
    <View style={[z.row,{justifyContent:'space-between',alignItems:'flex-start',paddingTop:8,marginBottom:12}]}>
      <View style={{flex:1}}>
        <Text style={[z.h1,{color:theme.text}]}>Wellness</Text>
        <Text style={[z.caps,{color:theme.muted,marginTop:4}]}>{new Date().toLocaleDateString('en-IN',{month:'long',day:'numeric',year:'numeric'})}</Text>
      </View>
      <TouchableOpacity style={{width:42,height:42,borderRadius:12,borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface,alignItems:'center',justifyContent:'center'}} onPress={function(){setShowCalendar(true);}}>
        <Text style={{fontSize:18}}>{'\uD83D\uDCC5'}</Text>
      </TouchableOpacity>
    </View>

    {/* W1: Member chip strip — tap to filter to that member, tap again or 'All' to clear */}
    {members.length>0&&<View style={{marginBottom:14,marginHorizontal:-20}}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:20,gap:10}}>
        <TouchableOpacity onPress={function(){haptic('light');setMemberFilterId(null);}} style={{alignItems:'center',width:72}}>
          <View style={{width:54,height:54,borderRadius:27,backgroundColor:!memberFilterId?theme.primary:theme.surfaceElevated,alignItems:'center',justifyContent:'center',marginBottom:6,borderWidth:2,borderColor:!memberFilterId?theme.primary:theme.background}}>
            <Text style={{fontSize:14,fontWeight:'700',color:!memberFilterId?'#FFFFFF':theme.text}}>All</Text>
          </View>
          <Text style={{fontSize:11,fontWeight:'600',color:theme.text}} numberOfLines={1}>Whole family</Text>
        </TouchableOpacity>
        {members.map(function(m,i){
          var slot=SLOTS[i%5];
          var sel=memberFilterId===m.id;
          return <TouchableOpacity key={'wmchip_'+m.id} onPress={function(){haptic('light');setMemberFilterId(sel?null:m.id);}} onLongPress={function(){haptic('medium');setMemberDetail(m);}} delayLongPress={350} style={{alignItems:'center',width:72}}>
            <View style={{width:54,height:54,borderRadius:27,backgroundColor:slot.bg,alignItems:'center',justifyContent:'center',marginBottom:6,borderWidth:sel?3:2,borderColor:sel?theme.primary:theme.background}}>
              <Text style={{fontSize:18,fontWeight:'700',color:slot.text}}>{(m.name||'?')[0]}</Text>
            </View>
            <Text style={{fontSize:11,fontWeight:'600',color:sel?theme.primary:theme.text}} numberOfLines={1}>{m.name}</Text>
          </TouchableOpacity>;
        })}
      </ScrollView>
    </View>}

    {memberFilterId&&<View style={[z.nudge,{backgroundColor:theme.primaryLight,borderLeftColor:theme.primary,marginBottom:14}]}>
      <Text style={[z.cap,{color:theme.primary,fontWeight:'600'}]}>Showing {(members.find(function(m){return m.id===memberFilterId;})||{}).name||'one member'} only \u00b7 long-press an avatar for their detail</Text>
    </View>}

    {/* Hero card — water column removed entirely (toggle is OFF by default; even when ON, this big hero stays focused on calories+protein) */}
    <View style={{borderRadius:20,backgroundColor:theme.primary,padding:18,marginBottom:14}}>
      <Text style={{fontSize:11,fontWeight:'600',color:'rgba(255,255,255,0.7)',letterSpacing:1.2,textTransform:'uppercase',marginBottom:14}}>{memberFilterId?(members.find(function(m){return m.id===memberFilterId;})||{}).name+' today':'What your family ate today'}</Text>
      <View style={{flexDirection:'row',justifyContent:'space-between'}}>
        <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setShowMeal(true);}} style={{flex:1}}>
          <Text style={{fontSize:24,fontWeight:'700',color:'#FFFFFF'}}>{(memberFilterId?(todayMeals||[]).filter(function(m){return m.memberId===memberFilterId;}):(todayMeals||[])).reduce(function(s,m){return s+(m.cal||0);},0)}</Text>
          <Text style={{fontSize:11,color:'rgba(255,255,255,0.75)',marginTop:2}}>Calories</Text>
        </TouchableOpacity>
        <View style={{width:1,backgroundColor:'rgba(255,255,255,0.18)',marginHorizontal:8}}/>
        <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setShowMeal(true);}} style={{flex:1}}>
          <Text style={{fontSize:24,fontWeight:'700',color:'#FFFFFF'}}>{memberFilterId?todayProteinForCurrentUser:totalProtein}<Text style={{fontSize:14,fontWeight:'500'}}>g</Text></Text>
          <Text style={{fontSize:11,color:'rgba(255,255,255,0.75)',marginTop:2}}>Protein</Text>
        </TouchableOpacity>
      </View>
    </View>

    <View style={[z.card,{marginTop:12,backgroundColor:theme.card,borderColor:theme.border}]}> 
      {/* W3: Tap protein target card to log a meal */}
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setShowMeal(true);}} style={{marginBottom:16}}>
        <Text style={[z.sub,{color:theme.text}]}>Your protein target today</Text>
        <Text style={[z.fv,{marginTop:4,color:theme.text}]}>{currentUserProteinTargets.regular}g (Regular) | {currentUserProteinTargets.active}g (Active/Gym)</Text>
        <Text style={[z.cap,{marginTop:4,color:theme.textSecondary}]}>Today: {todayProteinForCurrentUser}g</Text>
        <Bar pct={currentUserProteinTargets.active>0?Math.min((todayProteinForCurrentUser/currentUserProteinTargets.active)*100,100):0} color={theme.success}/>
      </TouchableOpacity>
      {/* W4: Tap family protein bar to see who logged what */}
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');
        // Open a quick sheet? For now jump to first non-met member, otherwise highlight
        var firstShort=perMemberTargets.find(function(x){return x.protein<x.target;});
        if(firstShort){setMemberDetail(firstShort.member);}
      }} style={{marginBottom:16}}><View style={[z.row,{justifyContent:'space-between',marginBottom:4}]}><Text style={[z.sub,{color:theme.text}]}>Family protein today</Text><Text style={[z.fv,{color:theme.text}]}>{totalProtein}g / {totalProteinTarget}g</Text></View><Bar pct={totalProteinTarget>0?Math.min((totalProtein/totalProteinTarget)*100,100):0} color={theme.success}/></TouchableOpacity>
      {/* Family water bar removed by user instruction. Per-member rows still tappable to see that member's detail. */}
      {(memberFilterId?perMemberTargets.filter(function(x){return x.member.id===memberFilterId;}):perMemberTargets).map(function(item,i){var m=item.member;var p=item.protein;var target=item.target;var w=item.wellnessRow;return<TouchableOpacity key={m.id} activeOpacity={0.7} onPress={function(){haptic('light');setMemberDetail(m);}} style={{marginBottom:12}}><View style={[z.row,{justifyContent:'space-between',marginBottom:4}]}><View style={z.row}><View style={[z.avS,{backgroundColor:SLOTS[i%5].bg,marginRight:8,borderColor:theme.border}]}><Text style={[z.avSTx,{color:SLOTS[i%5].text}]}>{m.name[0]}</Text></View><Text style={[z.body,{color:theme.text}]}>{m.name}</Text></View><Text style={[z.fv,{color:theme.text}]}>{p}g / {target}g</Text></View><Bar pct={Math.min((p/Math.max(target,1))*100,100)} color={p>=target?theme.success:theme.warning}/></TouchableOpacity>;})}
    </View>
    {/* B3: Action buttons — Water button only shows when toggle is ON */}
    <View style={[z.row,{gap:8,marginTop:4}]}>
      <TouchableOpacity style={[z.bPri,{flex:1}]} onPress={function(){haptic('light');setShowMeal(true);}}><Text style={z.bPriT}>+ Meal</Text></TouchableOpacity>
      {waterTrackingEnabled&&<TouchableOpacity style={[z.bSec,{flex:1}]} onPress={function(){haptic('light');setShowWater(true);}}><Text style={z.bSecT}>+ Water</Text></TouchableOpacity>}
      <TouchableOpacity style={[z.bSec,{flex:1}]} onPress={function(){haptic('light');setShowScreen(true);}}><Text style={z.bSecT}>+ Screen</Text></TouchableOpacity>
    </View>
    <Sec>Body goals you\u2019ve set</Sec>
    {wellnessGoals.slice(0,5).map(function(g){var pct=g.target>0?Math.round((Number(g.current||0)/Number(g.target||1))*100):0;return <TouchableOpacity key={g.id} style={[z.card,{marginBottom:8}]} onPress={function(){haptic('light');setEditGoal(g);}}><View style={[z.row,{justifyContent:'space-between'}]}><Text style={z.txM}>{g.name}</Text><Text style={[z.fv,{color:pct>=100?'#0F6E56':'#BA7517'}]}>{pct}%</Text></View><Text style={z.cap}>{g.category||'Wellness'} · {fmt(g.current||0)} / {fmt(g.target||0)}</Text><Bar pct={Math.min(pct,100)} color={pct>=100?'#0F6E56':'#EF9F27'}/></TouchableOpacity>;})}
    {wellnessGoals.length===0&&<Text style={z.cap}>No body goals yet.</Text>}
    <TouchableOpacity style={[z.bPri,{alignSelf:'flex-start',marginBottom:6}]} onPress={function(){setShowGoal(true);}}><Text style={z.bPriT}>+ New body goal</Text></TouchableOpacity>
    <Sec>What was eaten today</Sec>{(memberFilterId?todayMeals.filter(function(m){return m.memberId===memberFilterId;}):todayMeals).length===0&&<Text style={z.cap}>No meals captured today.</Text>}
    {/* W11: Meal time/member name now opens edit on tap */}
    {(memberFilterId?todayMeals.filter(function(m){return m.memberId===memberFilterId;}):todayMeals).map(function(m,i){return<View key={m.id||('meal_'+(m.memberId||m.member_name||'member')+'_'+(m.date||'date')+'_'+(m.mealTime||m.meal_type||'type')+'_'+i)} style={[z.card,{marginBottom:8}]}>
      <View style={[z.row,{justifyContent:'space-between',marginBottom:4}]}>
        <TouchableOpacity style={{flex:1}} onPress={function(){if(canModifyMemberData(isAdmin,members,userId,m.memberId)){haptic('light');setEditMeal(m);}else{Alert.alert('Read only','Only admin can edit other member logs.');}}}><Text style={z.txM}>{m.mealTime} - {m.memberName}</Text><Text style={z.cap}>{displayDate(m.date)}</Text></TouchableOpacity>
        <View style={z.row}><TouchableOpacity onPress={function(){if(canModifyMemberData(isAdmin,members,userId,m.memberId)){setEditMeal(m);}else{Alert.alert('Read only','Only admin can edit other member logs.');}}} style={z.editBtn}><Text style={z.editTx}>✎</Text></TouchableOpacity><TouchableOpacity onPress={function(){deleteMeal(m);}} style={z.editBtn}><Text style={[z.editTx,{color:'#E24B4A'}]}>🗑</Text></TouchableOpacity></View>
      </View>
      <Text style={[z.body,{marginBottom:6}]}>{m.items}</Text>
      <View style={z.row}><Text style={z.macro}>Protein: {m.protein}g</Text><Text style={z.macro}>Carbs: {m.carbs}g</Text><Text style={z.macro}>Cal: {m.cal}</Text></View>
    </View>;})}
    <Sec>Time on screens today</Sec>{(memberFilterId?members.filter(function(m){return m.id===memberFilterId;}):members).map(function(m){var w=todayW.find(function(w){return (w.memberId||w.member_id)===m.id;})||todayW.find(function(w){return w.memberName===m.name;});var hrs=w?w.screenHrs||0:0;var under=hrs<=4;return<TouchableOpacity key={m.id} activeOpacity={0.7} onPress={function(){haptic('light');setScreenDate(new Date());setShowScreen(true);}} style={[z.card,{marginBottom:8}]}><View style={[z.row,{justifyContent:'space-between',marginBottom:6}]}><Text style={z.txM}>{m.name}</Text><View style={z.row}><Text style={[z.fv,{color:hrs===0?'#888':under?'#085041':'#E24B4A'}]}>{hrs>0?hrs+' hrs':'\u2014'}</Text>{w&&<TouchableOpacity onPress={function(){deleteWellnessRow(w);}} style={z.editBtn}><Text style={[z.editTx,{color:'#E24B4A'}]}>🗑</Text></TouchableOpacity>}</View></View>{hrs>0&&<Bar pct={Math.min((hrs/4)*100,100)} color={under?'#0F6E56':'#E24B4A'}/>}</TouchableOpacity>;})}
    {/* W14: Insight card now jumps to Insights protein trend */}
    {totalProtein>0&&<TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setQuickAction&&setQuickAction({action:'focus_protein_trend',nonce:Date.now()});navigation.navigate('Insights');}} style={z.insight}><Text style={z.insightTx}>Your family ate {totalProtein}g of protein today. {totalProtein>=totalProteinTarget?'Everyone close to target.':'One egg or some paneer would close the gap.'} {'\u203A'}</Text></TouchableOpacity>}
    <View style={{height:32}}/></ScrollView></View>);
}

// ═══════════════════════════════════════════════════════════════
// INSIGHTS SCREEN
// ═══════════════════════════════════════════════════════════════
function InsightsScreen(){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var navigation=useNavigation();
  var{userId,familyId,transactions,meals,wellness,todayNudge,nudgeHistory,refreshNudges,refreshTodayNudge,refreshTransactions,refreshMeals,refreshWellness,recurringTransactions,refreshRecurringTransactions,quickAction,setQuickAction,dismissNudge,dismissedNudgeIds,upsertTransactionLocal}=useApp();
  var[selectedDate,setSelectedDate]=useState(new Date());
  var[showCalendar,setShowCalendar]=useState(false);
  var[showDayDetail,setShowDayDetail]=useState(false);
  var[dayDetailDate,setDayDetailDate]=useState(new Date());
  var[currentMonth,setCurrentMonth]=useState(startOfDay(new Date()));
  var[selectedHistoryDate,setSelectedHistoryDate]=useState('');
  var[historyOpen,setHistoryOpen]=useState(false);
  var[analyticsPeriod,setAnalyticsPeriod]=useState('month');
  var[monthCache,setMonthCache]=useState({});
  var[trendModal,setTrendModal]=useState(null); // {kind:'spend'|'protein'} for I8/I9
  var[editTx,setEditTx]=useState(null); // I15: tap a recurring row \u2192 open the matching tx
  var[refreshing,setRefreshing]=useState(false);

  useEffect(function(){refreshNudges&&refreshNudges();refreshRecurringTransactions&&refreshRecurringTransactions();},[]);

  // Handle quick-action requests routed from other tabs (e.g. focus_protein_trend, focus_week, focus_month)
  useEffect(function(){
    if(!quickAction||!quickAction.action)return;
    if(quickAction.action==='focus_protein_trend'){
      setTrendModal({kind:'protein'});
      setQuickAction(null);
    }
    if(quickAction.action==='focus_spend_trend'){
      setTrendModal({kind:'spend'});
      setQuickAction(null);
    }
    if(quickAction.action==='focus_week'){
      // already on Insights — ensure selectedDate is today, scroll-to-top happens by default
      setSelectedDate(new Date());
      setQuickAction(null);
    }
    if(quickAction.action==='focus_month'){
      setShowCalendar(true);
      setQuickAction(null);
    }
  },[quickAction]);

  async function onPullRefresh(){
    setRefreshing(true);
    try{
      await Promise.all([
        refreshNudges&&refreshNudges(),
        refreshTodayNudge&&refreshTodayNudge(),
        refreshRecurringTransactions&&refreshRecurringTransactions(),
        refreshTransactions&&refreshTransactions(),
        refreshMeals&&refreshMeals(),
        refreshWellness&&refreshWellness(),
      ].filter(Boolean));
    }catch(e){console.log('[INSIGHTS PULL REFRESH ERROR]',e);}
    setRefreshing(false);
  }

  var weekly=[];
  for(var i=6;i>=0;i--){
    var d=addDays(new Date(),-i);
    weekly.push(calcDayCompletion(familyId,d,transactions,meals,wellness));
  }
  var weeklyAvg=Math.round(weekly.reduce(function(s,x){return s+x.percent;},0)/Math.max(weekly.length,1));
  var txTrend=weekly.map(function(w){
    return (transactions||[]).filter(function(t){return isoDate(t.date)===w.date && t.category!=='Income';}).reduce(function(s,t){return s+(t.amount||0);},0);
  });
  var proteinTrend=weekly.map(function(w){
    return (meals||[]).filter(function(m){return isoDate(m.date)===w.date;}).reduce(function(s,m){return s+(m.protein||0);},0);
  });

  function monthDaysGrid(baseMonth){
    var first=new Date(baseMonth.getFullYear(),baseMonth.getMonth(),1);
    var startWeekDay=(first.getDay()+6)%7; // Monday-start
    var start=addDays(first,-startWeekDay);
    var cells=[];
    for(var i=0;i<42;i++)cells.push(addDays(start,i));
    return cells;
  }

  var currentMonthKey=monthKey(currentMonth);
  useEffect(function(){
    setMonthCache({});
  },[familyId,transactions,meals,wellness]);
  useEffect(function(){
    if(monthCache[currentMonthKey])return;
    var cells=monthDaysGrid(currentMonth).map(function(d){
      return Object.assign({},calcDayCompletion(familyId,d,transactions,meals,wellness),{dateObj:d});
    });
    setMonthCache(function(prev){var next=Object.assign({},prev);next[currentMonthKey]=cells;return next;});
  },[currentMonthKey,familyId,transactions.length,meals.length,wellness.length]);
  var monthCells=(monthCache[currentMonthKey]||monthDaysGrid(currentMonth).map(function(d){return Object.assign({},calcDayCompletion(familyId,d,transactions,meals,wellness),{dateObj:d});}));
  var selectedISO=isoDate(selectedDate);
  var selectedSummary=calcDayCompletion(familyId,selectedDate,transactions,meals,wellness);
  var selectedTx=(transactions||[]).filter(function(t){return isoDate(t.date)===selectedISO;});
  var selectedMeals=(meals||[]).filter(function(m){return isoDate(m.date)===selectedISO;});
  var selectedWell=(wellness||[]).filter(function(w){return w.date===selectedISO;});

  var historyList=(nudgeHistory||[]).filter(function(n){
    if((dismissedNudgeIds||[]).indexOf(n.id)!==-1)return false;
    if(!selectedHistoryDate)return true;
    return isoDate(n.sent_at)===selectedHistoryDate;
  });
  var visibleTodayNudge=(todayNudge&&dismissedNudgeIds.indexOf(todayNudge.id)===-1)?todayNudge:null;

  var upcomingRecurring=(recurringTransactions||[]).filter(function(r){
    if(!r.is_active)return false;
    var due=toDate(r.next_due_date||new Date());
    var diff=Math.floor((startOfDay(due)-startOfDay(new Date()))/86400000);
    return diff>=0&&diff<=7;
  }).sort(function(a,b){return String(a.next_due_date).localeCompare(String(b.next_due_date));});

  var analyticsStart=analyticsPeriod==='week'?addDays(new Date(),-6):analyticsPeriod==='quarter'?addDays(new Date(),-89):addDays(new Date(),-29);
  var analyticsTx=(transactions||[]).filter(function(t){return t.category!=='Income'&&toDate(t.date)>=startOfDay(analyticsStart);});
  var spendByCat={};analyticsTx.forEach(function(t){spendByCat[t.category||'Uncat']=(spendByCat[t.category||'Uncat']||0)+Number(t.amount||0);});
  var pieData=Object.keys(spendByCat).slice(0,6).map(function(c,i){return{name:c,amount:spendByCat[c],color:Object.values(CAT_COLORS)[i%Object.values(CAT_COLORS).length]||'#888',legendFontColor:'#333',legendFontSize:11};});
  var dayMap={};analyticsTx.forEach(function(t){var key=isoDate(t.date);dayMap[key]=(dayMap[key]||0)+Number(t.amount||0);});
  var days=[];for(var d=6;d>=0;d--){var day=addDays(new Date(),-d);var key=isoDate(day);days.push({label:key.slice(5),value:Math.round(dayMap[key]||0)});} 

  async function generateNow(){
    try{
      await fetch(EDGE_NUDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SUPABASE_ANON_KEY},body:JSON.stringify({user_id:userId})});
      setTimeout(function(){refreshTodayNudge&&refreshTodayNudge(userId);refreshNudges&&refreshNudges();},1200);
      Alert.alert('Requested','A fresh nudge is being generated. Pull to refresh in a moment.');
    }catch(e){showFriendlyError('Could not generate nudge',e);}
  }

  function quickActionCard(title,subtitle,action){
    return <TouchableOpacity key={title} style={[z.card,{marginBottom:8}]} onPress={function(){setQuickAction&&setQuickAction(action);if(action&&action.tab)navigation.navigate(action.tab);}}>
      <Text style={z.txM}>{title}</Text>
      <Text style={z.cap}>{subtitle}</Text>
    </TouchableOpacity>;
  }

  var quickCards=[];
  if(selectedSummary.percent<100){
    if(!selectedSummary.flags.transaction)quickCards.push(quickActionCard('Capture an entry','The day isn\u2019t fully seen yet',{action:'open_tx',tab:'Finance',nonce:Date.now()}));
    if(!selectedSummary.flags.breakfast)quickCards.push(quickActionCard('Note breakfast','Breakfast still pending',{action:'open_meal',mealType:'breakfast',tab:'Wellness',nonce:Date.now()}));
    if(!selectedSummary.flags.lunch)quickCards.push(quickActionCard('Note lunch','Lunch still pending',{action:'open_meal',mealType:'lunch',tab:'Wellness',nonce:Date.now()}));
    if(!selectedSummary.flags.dinner)quickCards.push(quickActionCard('Note dinner','Dinner still pending',{action:'open_meal',mealType:'dinner',tab:'Wellness',nonce:Date.now()}));
    if(!selectedSummary.flags.screen)quickCards.push(quickActionCard('Note screen time','Screen time still pending',{action:'open_screen',tab:'Wellness',nonce:Date.now()}));
  }

  return(<View style={[z.scr,{paddingTop:ins.top,backgroundColor:theme.background}]}> 
    <UnifiedCalendarModal visible={showCalendar} onClose={function(){setShowCalendar(false);}} context="insights" selectedDate={selectedDate} onSelectDate={setSelectedDate} onOpenDayDetail={function(d){setSelectedDate(d);setDayDetailDate(d);setShowDayDetail(true);}}/>
    <DayDetailModal visible={showDayDetail} date={dayDetailDate} onClose={function(){setShowDayDetail(false);}} onChangeDate={function(d){setDayDetailDate(d);setSelectedDate(d);}} onAddTransaction={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_tx',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Finance');}} onAddMeal={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_meal',mealType:'lunch',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}} onAddWater={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_water',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}} onAddScreen={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_screen',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}}/>
    <ScrollView style={z.fl} contentContainerStyle={z.pad} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.primary} colors={[theme.primary]}/>}
    >
      <View style={[z.row,{justifyContent:'space-between',alignItems:'flex-start',paddingTop:8,marginBottom:6}]}>
        <View style={{flex:1}}>
          <Text style={[z.h1,{color:theme.text}]}>Insights</Text>
          <Text style={[z.caps,{color:theme.muted,marginTop:4}]}>What your family\u2019s week looks like</Text>
        </View>
        <View style={[z.row,{gap:8}]}>
          <TouchableOpacity style={{width:42,height:42,borderRadius:12,borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface,alignItems:'center',justifyContent:'center'}} onPress={function(){setShowCalendar(true);}}>
            <Text style={{fontSize:18}}>{'\uD83D\uDCC5'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[z.bSec,{borderColor:theme.primary,paddingHorizontal:14}]} onPress={generateNow}>
            <Text style={[z.bSecT,{color:theme.primary}]}>Reflect now</Text>
          </TouchableOpacity>
        </View>
      </View>

      {visibleTodayNudge&&<View style={[z.nudge,{marginTop:12,backgroundColor:theme.accentLight,borderLeftColor:theme.accent}]}>
        <View style={[z.row,{justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}]}>
          <Text style={[z.cap,{color:theme.accent,textTransform:'uppercase',letterSpacing:0.6,fontWeight:'700'}]}>Today\u2019s reflection</Text>
          <TouchableOpacity onPress={function(){dismissNudge&&dismissNudge(visibleTodayNudge.id);}}><Text style={[z.cap,{color:theme.accent,fontWeight:'600'}]}>Dismiss</Text></TouchableOpacity>
        </View>
        <Text style={[z.nudgeTx,{color:theme.text}]}>{visibleTodayNudge.nudge_text}</Text>
        <Text style={[z.cap,{marginTop:6,color:theme.accent,fontWeight:'600'}]}>{displayDate(visibleTodayNudge.sent_at)}</Text>
      </View>}

      <Sec>Past reflections</Sec>
      <View style={[z.row,{alignItems:'center',gap:8,marginBottom:8}]}> 
        <TouchableOpacity style={[z.bSec,{flex:1}]} onPress={function(){setHistoryOpen(true);}}><Text style={z.bSecT}>{selectedHistoryDate?selectedHistoryDate:'Filter by date'}</Text></TouchableOpacity>
        {selectedHistoryDate?<TouchableOpacity style={z.bSec} onPress={function(){setSelectedHistoryDate('');}}><Text style={z.bSecT}>Clear</Text></TouchableOpacity>:null}
      </View>
      {historyOpen&&<Modal visible={true} transparent animationType="fade"><View style={[z.modalWrap,{justifyContent:'center'}]}><View style={[z.modal,{margin:20,maxHeight:420}]}> 
        <Text style={z.h1}>Choose date</Text>
        <DateField label="Reflection date" value={selectedHistoryDate?new Date(selectedHistoryDate):new Date()} onChange={function(d){setSelectedHistoryDate(isoDate(d));setHistoryOpen(false);}} maximumDate={new Date()}/>
        <TouchableOpacity style={z.bSec} onPress={function(){setHistoryOpen(false);}}><Text style={z.bSecT}>Done</Text></TouchableOpacity>
      </View></View></Modal>}
      {historyList.slice(0,10).map(function(n){return<View key={n.id} style={[z.card,{marginBottom:8}]}><View style={[z.row,{justifyContent:'space-between',alignItems:'flex-start'}]}><Text style={[z.cap,{marginBottom:4,textTransform:'uppercase',flex:1}]}>{n.domain||'general'} · {displayDate(n.sent_at)}</Text><TouchableOpacity onPress={function(){dismissNudge&&dismissNudge(n.id);}}><Text style={[z.cap,{color:'#BA7517',fontWeight:'500'}]}>Dismiss</Text></TouchableOpacity></View><Text style={z.body}>{n.nudge_text}</Text></View>;})}
      {historyList.length===0&&<Text style={z.cap}>No reflections for this date.</Text>}

      <Sec>How the week went</Sec>
      <View style={z.card}>
        {/* I6: tap average to scroll calendar to this week */}
        <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setSelectedDate(new Date());setCurrentMonth(startOfDay(new Date()));}} style={[z.row,{justifyContent:'space-between',marginBottom:8}]}><Text style={z.sub}>Average daily completeness</Text><Text style={z.fv}>{weeklyAvg}%</Text></TouchableOpacity>
        {/* I7: tap a daily bar to open This Day modal */}
        <View style={z.barRow}>{weekly.map(function(w,i){
          var dayOffset=6-i;
          var barDate=addDays(new Date(),-dayOffset);
          return <TouchableOpacity key={w.date} activeOpacity={0.7} onPress={function(){haptic('light');setSelectedDate(barDate);setDayDetailDate(barDate);setShowDayDetail(true);}} style={z.barC}><View style={[z.bar,{height:Math.max((w.percent/100)*80,4),backgroundColor:getCompletionColor(w.percent)}]}/><Text style={z.barL}>{['M','T','W','T','F','S','S'][i]}</Text></TouchableOpacity>;
        })}</View>
      </View>
      <View style={[z.row,{gap:8}]}> 
        {/* I8: tap spend trend mini-card to open full-screen trend */}
        <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setTrendModal({kind:'spend'});}} style={[z.card,{flex:1}]}> 
          <Text style={z.sub}>Where spending is heading</Text>
          {txTrend.map(function(v,i){return <Text key={i} style={z.cap}>{i===6?'Today':i+'d ago'}: ₹{fmt(v)}</Text>;})}
          <Text style={[z.cap,{color:theme.primary,fontWeight:'600',marginTop:4}]}>See full trend \u203A</Text>
        </TouchableOpacity>
        {/* I9: tap protein trend mini-card to open full-screen trend */}
        <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setTrendModal({kind:'protein'});}} style={[z.card,{flex:1}]}> 
          <Text style={z.sub}>Where protein is heading</Text>
          {proteinTrend.map(function(v,i){return <Text key={i} style={z.cap}>{i===6?'Today':i+'d ago'}: {v}g</Text>;})}
          <Text style={[z.cap,{color:theme.primary,fontWeight:'600',marginTop:4}]}>See full trend \u203A</Text>
        </TouchableOpacity>
      </View>

      <Sec>What you spend on</Sec>
      <View style={[z.row,{gap:8,marginBottom:8}]}> 
        {['week','month','quarter'].map(function(p){var sel=analyticsPeriod===p;return <TouchableOpacity key={p} style={[z.chip,sel&&z.chipSel]} onPress={function(){haptic('light');setAnalyticsPeriod(p);}}><Text style={[z.chipTx,sel&&z.chipSelTx]}>{p}</Text></TouchableOpacity>;})}
      </View>
      {pieData.length>0?<View style={z.card}>
        <PieChart data={pieData} width={Math.min(Dimensions.get('window').width-56,340)} height={170} accessor="amount" backgroundColor="transparent" paddingLeft="8" chartConfig={{color:function(){return '#333';}}}/>
      </View>:<Text style={z.cap}>No spending data for selected period.</Text>}
      {/* I12: tap a daily bar in week chart \u2192 This Day modal */}
      <View style={z.card}>
        <Text style={z.sub}>What was spent each day this week</Text>
        <BarChart data={{labels:days.map(function(d){return d.label;}),datasets:[{data:days.map(function(d){return d.value;})}]}} width={Math.min(Dimensions.get('window').width-56,340)} height={180} fromZero yAxisLabel="₹" withInnerLines={false} showBarTops={false} chartConfig={{backgroundGradientFrom:'#FFFFFF',backgroundGradientTo:'#FFFFFF',decimalPlaces:0,color:function(){return '#085041';},labelColor:function(){return '#555';},propsForBackgroundLines:{strokeWidth:0,stroke:'transparent'}}} style={{marginTop:8,borderRadius:8}}/>
        <View style={[z.row,{justifyContent:'space-between',marginTop:8}]}>{days.map(function(d,i){return <TouchableOpacity key={'spendday'+i} onPress={function(){haptic('light');setDayDetailDate(toDate(d.date));setSelectedDate(toDate(d.date));setShowDayDetail(true);}} style={{flex:1,alignItems:'center',paddingVertical:6}}><Text style={[z.cap,{color:theme.primary,fontWeight:'600'}]}>{d.label}</Text></TouchableOpacity>;})}</View>
      </View>

      <Sec>The whole month</Sec>
      <View style={z.card}>
        <View style={[z.row,{justifyContent:'space-between',marginBottom:10}]}> 
          <TouchableOpacity onPress={function(){setCurrentMonth(new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1));}}><Text style={z.linkTx}>‹ Prev</Text></TouchableOpacity>
          <Text style={z.txM}>{currentMonth.toLocaleString('en-IN',{month:'long',year:'numeric'})}</Text>
          <TouchableOpacity onPress={function(){setCurrentMonth(new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1));}}><Text style={z.linkTx}>Next ›</Text></TouchableOpacity>
        </View>
        <View style={[z.row,{justifyContent:'space-between',marginBottom:6}]}>{['M','T','W','T','F','S','S'].map(function(d,idx){return<Text key={d+'_'+idx} style={[z.cap,{width:'14%',textAlign:'center'}]}>{d}</Text>;})}</View>
        <View style={{flexDirection:'row',flexWrap:'wrap'}}>
          {monthCells.map(function(cell){
            var d=cell.dateObj;
            var inMonth=d.getMonth()===currentMonth.getMonth();
            var bg=inMonth?getCompletionColor(cell.percent)+'22':'#F2F2EE';
            var isSel=isoDate(d)===selectedISO;
            return <TouchableOpacity key={cell.date} style={[z.calCell,{backgroundColor:bg,borderColor:isSel?'#085041':'transparent'}]}
              onPress={function(){
                // I13: tap selected day again to open This Day modal; first tap selects
                if(isSel){haptic('light');setDayDetailDate(d);setShowDayDetail(true);} else {haptic('light');setSelectedDate(d);}
              }}
              onLongPress={function(){haptic('medium');setDayDetailDate(d);setSelectedDate(d);setShowDayDetail(true);}}
              delayLongPress={300}
            >
              <Text style={[z.calCellTx,!inMonth&&{color:'#BBB'}]}>{d.getDate()}</Text>
              <View style={[z.calDot,{backgroundColor:getCompletionColor(cell.percent)}]}/>
            </TouchableOpacity>;
          })}
        </View>
        <Text style={[z.cap,{marginTop:8,textAlign:'center',color:theme.muted}]}>Tap a day to select. Tap again or long-press to see the day in detail.</Text>
      </View>
      {/* I14: tap "On this day" card to open This Day modal */}
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setDayDetailDate(selectedDate);setShowDayDetail(true);}} style={z.card}>
        <Text style={z.txM}>On this day: {displayDate(selectedDate)}</Text>
        <Text style={z.cap}>Captured: {selectedSummary.completed}/5 ({selectedSummary.percent}%)</Text>
        <Text style={[z.cap,{marginTop:6}]}>Entries: {selectedTx.length} · Meals: {selectedMeals.length} · Body logs: {selectedWell.length}</Text>
        <Text style={[z.cap,{color:theme.primary,fontWeight:'600',marginTop:6}]}>Open day in detail \u203A</Text>
      </TouchableOpacity>

      <Sec>Things due soon</Sec>
      {/* I15: tap a recurring row to open the related transaction */}
      {upcomingRecurring.map(function(r){return<TouchableOpacity activeOpacity={0.7} onPress={function(){
        var related=(transactions||[]).find(function(t){return t.recurring_transaction_id===r.id;});
        if(related){haptic('light');setEditTx(related);}
        else{
          haptic('light');
          var stub={id:null,merchant:r.description,amount:r.amount,category:r.category||'',date:r.next_due_date,recurring_transaction_id:r.id};
          setEditTx(stub);
        }
      }} key={r.id} style={[z.card,{marginBottom:8}]}><View style={[z.row,{justifyContent:'space-between'}]}><Text style={z.txM}>{r.description}</Text><Text style={z.fv}>₹{fmt(r.amount)}</Text></View><Text style={z.cap}>Due: {displayDate(r.next_due_date)} · {r.frequency}</Text></TouchableOpacity>;})}
      {upcomingRecurring.length===0&&<Text style={z.cap}>Nothing due in the next 7 days.</Text>}

      <Sec>What would close today</Sec>
      {quickCards.length>0?quickCards:<Text style={z.cap}>This day is fully captured 🎉</Text>}
      <View style={{height:28}}/>
    </ScrollView>
    {/* Trend detail modal mounted at root */}
    <TrendDetailModal visible={!!trendModal} onClose={function(){setTrendModal(null);}}
      kind={trendModal&&trendModal.kind}
      data={trendModal&&trendModal.kind==='spend'?txTrend:proteinTrend}
      labels={['6d','5d','4d','3d','2d','1d','Today']}
    />
    {/* I15 follow-up: edit transaction modal mounted */}
    {editTx&&<AddTxModal visible={true} onClose={function(){setEditTx(null);}} editTx={editTx}/>}
  </View>);
}

// ═══════════════════════════════════════════════════════════════
// FAMILY SCREEN
// ═══════════════════════════════════════════════════════════════
// B6: Family Screen now reads real scores from family_scores + streaks tables.
// B7: Pending members (those without a user_id linked) show an "Invite" button visible to the admin.
function FamilyScreen(){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var navigation=useNavigation();
  var{familyId,familyName,setFamilyName,members,transactions,meals,goals,wellness,scores,streaks,isAdmin,userId,memberProfiles,sharedGoals,sharedGoalContributions,activityFeed,refreshSharedGoals,refreshSharedGoalContributions,refreshActivityFeed,refreshTransactions,refreshMeals,refreshWellness,refreshMembers,setQuickAction}=useApp();
  var now=new Date();var today=isoDate(now);
  var monday=mondayOfWeek(now);
  var[inviteSheet,setInviteSheet]=useState(null); // B7: holds the member whose invite modal is open
  var[showSharedGoalModal,setShowSharedGoalModal]=useState(false);
  var[activeSharedGoal,setActiveSharedGoal]=useState(null);
  var[contributeGoal,setContributeGoal]=useState(null);
  var[activityFilterDate,setActivityFilterDate]=useState(new Date());
  var[showActivityDatePicker,setShowActivityDatePicker]=useState(false);
  var[showRename,setShowRename]=useState(false); // FA2
  var[memberDetail,setMemberDetail]=useState(null); // FA5/FA6/FA7/FA8/FA11/FA16
  var[scoreScope,setScoreScope]=useState(null); // {scope:'family'|'member', member:...} for FA4/FA14/FA6
  var[refreshing,setRefreshing]=useState(false);
  var creatorMember=(members||[]).find(function(m){return m.userId===userId;})||((isAdmin&&members&&members.length)?members[0]:null);
  var creatorMemberId=creatorMember?creatorMember.id:null;

  async function onPullRefresh(){
    setRefreshing(true);
    try{
      await Promise.all([
        refreshMembers&&refreshMembers(),
        refreshSharedGoals&&refreshSharedGoals(),
        refreshSharedGoalContributions&&refreshSharedGoalContributions(),
        refreshActivityFeed&&refreshActivityFeed(),
        refreshTransactions&&refreshTransactions(),
        refreshMeals&&refreshMeals(),
        refreshWellness&&refreshWellness(),
      ].filter(Boolean));
    }catch(e){console.log('[FAMILY PULL REFRESH ERROR]',e);}
    setRefreshing(false);
  }

  function jumpThisWeek(tab){
    setQuickAction&&setQuickAction({action:'focus_week',nonce:Date.now()});
    navigation.navigate(tab);
  }

  // B6: This week's scores per member, summed from the family_scores table
  var thisWeekScores=(scores||[]).filter(function(s){var d=new Date(s.date);return d>=monday;});
  var prevWeekScores=(scores||[]).filter(function(s){var d=new Date(s.date);var wk=new Date(monday);wk.setDate(wk.getDate()-7);return d>=wk && d<monday;});
  var ptsForMember=function(mid,arr){return(arr||[]).filter(function(s){return s.member_id===mid;}).reduce(function(sum,s){return sum+(s.points_earned||0);},0);};
  var familyBonusPts=(thisWeekScores||[]).filter(function(s){return s.member_id==='family';}).reduce(function(sum,s){return sum+(s.points_earned||0);},0);
  var totalScore=(members||[]).reduce(function(sum,m){return sum+ptsForMember(m.id,thisWeekScores);},0)+familyBonusPts;
  var prevTotalScore=(members||[]).reduce(function(sum,m){return sum+ptsForMember(m.id,prevWeekScores);},0);
  var deltaFromLastWeek=totalScore-prevTotalScore;

  // Per-member card data
  var memberScores=(members||[]).map(function(m,i){
    var weekPts=ptsForMember(m.id,thisWeekScores);
    // Best streak across any habit for this member
    var memStreaks=(streaks||[]).filter(function(s){return s.member_id===m.id;});
    var topStreak=memStreaks.reduce(function(mx,s){return Math.max(mx,s.current_streak||0);},0);
    // Today's activity count — did they do meals, tx, water today? 0..3
    var dM=meals.filter(function(ml){return ml.memberId===m.id && isoDate(ml.date)===today;}).length>0?1:0;
    var dT=transactions.filter(function(t){return t.memberId===m.id && isoDate(t.date)===today && t.confirmed;}).length>0?1:0;
    var dW=wellness.filter(function(w){return w.memberId===m.id && w.date===today;}).length>0?1:0;
    var joined=!!m.userId;
    var isCurrentUser=m.userId===userId;
    var roleLabel=getMemberRoleDisplay(m);
    var isAdminRole=isMemberAdmin(m);
    return{id:m.id,name:m.name,role:roleLabel,isAdminRole:isAdminRole,pts:weekPts,streak:topStreak,daily:dM+dT+dW,max:3,color:CARD_BG[i%5],joined:joined,isCurrentUser:isCurrentUser,inviteCode:m.inviteCode,inviteExpiresAt:m.inviteExpiresAt};
  });

  var objectives=[];
  (goals||[]).forEach(function(g){objectives.push({icon:'\uD83C\uDFFA',label:g.name,scope:'Goal progress',pct:g.target>0?Math.round((g.current/g.target)*100):0,detail:fmt(g.current)+' / '+fmt(g.target)});});
  var proteinByMemberId={};
  (meals||[]).forEach(function(ml){
    if(isoDate(ml.date)!==today)return;
    var mk=ml.memberId||ml.member_id||('name_'+String(ml.memberName||ml.member_name||''));
    proteinByMemberId[mk]=(proteinByMemberId[mk]||0)+Number(ml.protein||0);
  });
  var memberProteinTargets=(members||[]).map(function(m){
    var profile=(memberProfiles&&m.userId)?memberProfiles[m.userId]:null;
    var targets=calculateProteinTargets(profile&&profile.weightKg?profile.weightKg:null);
    var consumed=proteinByMemberId[m.id]||proteinByMemberId['name_'+m.name]||0;
    return {member:m,protein:consumed,targets:targets};
  });
  var activityFilterISO=isoDate(activityFilterDate);
  var filteredActivities=(activityFeed||[]).filter(function(a){return isoDate(a.created_at)===activityFilterISO;});

  return(<View style={[z.fScr,{paddingTop:ins.top,backgroundColor:theme.background}]}>
    {inviteSheet&&<InviteModal member={inviteSheet} familyId={familyId} familyName={familyName} onClose={function(){setInviteSheet(null);}}/>}
    <SharedGoalModal visible={showSharedGoalModal} onClose={function(){setShowSharedGoalModal(false);setActiveSharedGoal(null);}} goal={activeSharedGoal}/>
    <SharedGoalContributionModal visible={!!contributeGoal} onClose={function(){setContributeGoal(null);}} goal={contributeGoal}/>
    <RenameFamilyModal visible={showRename} onClose={function(){setShowRename(false);}} familyId={familyId} currentName={familyName} onRenamed={function(newName){setFamilyName&&setFamilyName(newName);}}/>
    <MemberDetailModal visible={!!memberDetail} member={memberDetail} onClose={function(){setMemberDetail(null);}}
      onJumpProtein={function(m){setMemberDetail(null);setQuickAction&&setQuickAction({action:'focus_member',memberName:m.name,nonce:Date.now()});navigation.navigate('Wellness');}}
      onJumpScreens={function(m){setMemberDetail(null);setQuickAction&&setQuickAction({action:'focus_member',memberName:m.name,nonce:Date.now()});navigation.navigate('Wellness');}}
      onJumpStreak={function(m){setMemberDetail(null);setScoreScope({scope:'member',member:m});}}
      onJumpScoreBreakdown={function(m){setMemberDetail(null);setScoreScope({scope:'member',member:m});}}
      onJumpToday={function(m){setMemberDetail(null);setActivityFilterDate(new Date());}}
    />
    <ScoreBreakdownModal visible={!!scoreScope} onClose={function(){setScoreScope(null);}} scope={scoreScope&&scoreScope.scope} member={scoreScope&&scoreScope.member}/>
    <ScrollView style={z.fl} contentContainerStyle={z.pad} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.primary} colors={[theme.primary]}/>}
    >
    <View style={[z.row,{justifyContent:'space-between',alignItems:'flex-start',paddingTop:8,marginBottom:18}]}>
      <View style={{flex:1}}>
        <Text style={[z.caps,{color:theme.muted,marginBottom:4}]}>Family</Text>
        {/* FA2: tap family name (admin) to rename */}
        <TouchableOpacity activeOpacity={isAdmin?0.7:1} onPress={function(){if(isAdmin){haptic('light');setShowRename(true);}}}>
          <Text style={[z.h1,{color:theme.text,fontSize:26}]} numberOfLines={1}>{familyName||'Your Family'}{isAdmin?' \u270E':''}</Text>
        </TouchableOpacity>
      </View>
      {isAdmin&&<TouchableOpacity style={[z.bSec,{borderColor:theme.primary,paddingHorizontal:14}]} onPress={function(){var pendingMember=(memberScores||[]).find(function(c){return !c.joined && c.id!==creatorMemberId;});if(pendingMember){setInviteSheet(pendingMember);}else{Alert.alert('Add members in Settings','Invite codes are managed from the Family section in Settings.');}}}>
        <Text style={[z.bSecT,{color:theme.primary}]}>+ Invite</Text>
      </TouchableOpacity>}
    </View>

    {/* FA4: tap big star score to see breakdown */}
    <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setScoreScope({scope:'family'});}} style={{flexDirection:'row',alignItems:'center',backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:18,padding:18,marginBottom:18}}>
      <View style={{width:54,height:54,borderRadius:27,backgroundColor:theme.accentLight,alignItems:'center',justifyContent:'center',marginRight:14}}>
        <Text style={{fontSize:24}}>{'\u2B50'}</Text>
      </View>
      <View style={{flex:1}}>
        <Text style={{fontSize:32,fontWeight:'700',color:theme.text,letterSpacing:-0.8,lineHeight:36}}>{fmt(totalScore)}</Text>
        <Text style={{fontSize:12,fontWeight:'500',color:theme.textSecondary,marginTop:2}}>This week{deltaFromLastWeek!==0?(deltaFromLastWeek>0?' \u00b7 \u2191':' \u00b7 \u2193')+' '+Math.abs(deltaFromLastWeek)+' from last week':''}</Text>
      </View>
      <Text style={{fontSize:18,color:theme.muted}}>{'\u203A'}</Text>
    </TouchableOpacity>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:20,marginHorizontal:-20}} contentContainerStyle={{paddingHorizontal:20}}>
      {/* FA5/FA6/FA7/FA8: every member chip is tappable. Tap = open detail; long-press = open detail too (consistent) */}
      {memberScores.map(function(c,i){var memObj=members.find(function(m){return m.id===c.id;});return<TouchableOpacity key={c.id} activeOpacity={0.85} onPress={function(){haptic('light');if(memObj)setMemberDetail(memObj);}} onLongPress={function(){if(c.isAdminRole){haptic('medium');Alert.alert('Admin','Admin transfer is not yet supported. Contact support.');}}} delayLongPress={400} style={[z.chCard,{backgroundColor:c.color,marginRight:12,opacity:c.joined?1:0.78}]}>
        <View style={z.chAv}><Text style={[z.chAvT,{color:c.color}]}>{(c.name||'?')[0]}</Text></View>
        <View style={[z.row,{alignItems:'center',justifyContent:'center',flexWrap:'wrap'}]}><Text style={[z.chNm,{maxWidth:120,minHeight:34,textAlign:'center',paddingHorizontal:6,flexWrap:'wrap'}]} numberOfLines={2} ellipsizeMode="tail">{c.name||'Unknown'}</Text>{c.isAdminRole&&<View style={z.adminBadge}><Text style={z.adminBadgeTx}>{'\uD83D\uDC51'} Admin</Text></View>}</View>
        <Text style={z.chRole}>{c.role}</Text>
        <Text style={z.chPts}>{c.pts} pts</Text>
        <Text style={z.chStrk}>{c.streak>0?c.streak+'-day streak':'No streak yet'}</Text>
        <View style={{marginTop:8,width:'100%'}}>
          <View style={z.chPTrk}><View style={[z.chPFl,{width:(c.daily/c.max*100)+'%'}]}/></View>
          <Text style={z.chDly}>{c.daily}/{c.max} today</Text>
        </View>
        {!c.joined && isAdmin && c.id!==creatorMemberId && <TouchableOpacity style={z.chInvite} onPress={function(){haptic('light');setInviteSheet(c);}}><Text style={z.chInviteTx}>Invite {c.name}</Text></TouchableOpacity>}
        {!c.joined && !isAdmin && <Text style={[z.chDly,{marginTop:8}]}>Not joined yet</Text>}
      </TouchableOpacity>;})}
    </ScrollView>
    <Sec>What your family is working toward</Sec>{objectives.length===0&&<Text style={[z.cap,{color:theme.muted}]}>Add goals and capture meals to see what your family is working toward.</Text>}
    {/* FA10: tap an objective row to open the related goal — we navigate to Finance focus_goals (it's where goals live) */}
    {objectives.map(function(ob,i){return<TouchableOpacity key={i} activeOpacity={0.7} onPress={function(){haptic('light');setQuickAction&&setQuickAction({action:'focus_goals',nonce:Date.now()});navigation.navigate('Finance');}} style={[z.card,{marginBottom:8,backgroundColor:theme.card,borderColor:theme.border}]}><View style={[z.row,{marginBottom:6}]}><Text style={{fontSize:20,marginRight:8}}>{ob.icon}</Text><View style={{flex:1}}><Text style={[z.txM,{color:theme.text}]}>{ob.label}</Text><Text style={[z.cap,{color:theme.muted}]}>{ob.scope}{ob.detail?' · '+ob.detail:''}</Text></View><Text style={[z.fv,{color:theme.warning}]}>{ob.pct}%</Text></View><Bar pct={Math.min(ob.pct||0,100)} color={theme.warning}/></TouchableOpacity>;})}
    <Sec>Each person\u2019s protein</Sec>
    {/* FA11: tap a person row to open their wellness detail */}
    {memberProteinTargets.map(function(item){
      var member=item.member;
      var protein=item.protein;
      var activeTarget=item.targets.active;
      var regularTarget=item.targets.regular;
      var progress=activeTarget>0?Math.min((protein/activeTarget)*100,100):0;
      return <TouchableOpacity key={'protein_'+member.id} activeOpacity={0.7} onPress={function(){haptic('light');setMemberDetail(member);}} style={[z.card,{marginBottom:8,backgroundColor:theme.card,borderColor:theme.border}]}> 
        <View style={[z.row,{justifyContent:'space-between',alignItems:'center'}]}>
          <Text style={[z.txM,{color:theme.text,flex:1,marginRight:8}]} numberOfLines={2} ellipsizeMode="tail">{member.name||'Unknown'}</Text>
          <Text style={[z.cap,{color:theme.textSecondary}]}>R: {regularTarget}g · A: {activeTarget}g</Text>
        </View>
        <Text style={[z.fv,{marginTop:6,color:theme.text}]}>{protein}g / {activeTarget}g</Text>
        <Bar pct={progress} color={protein>=activeTarget?theme.success:theme.warning}/>
      </TouchableOpacity>;
    })}
    <Sec>How this week looked</Sec><View style={[z.card,{backgroundColor:theme.card,borderColor:theme.border}]}>
      {/* FA12: each count is tappable and jumps to the relevant tab */}
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');jumpThisWeek('Finance');}} style={[z.row,{justifyContent:'space-between',marginBottom:8}]}><Text style={z.sub}>Money entries</Text><Text style={z.fv}>{transactions.filter(function(t){return isThisWeek(t.date);}).length} captured</Text></TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');jumpThisWeek('Wellness');}} style={[z.row,{justifyContent:'space-between',marginBottom:8}]}><Text style={z.sub}>Meals</Text><Text style={z.fv}>{meals.filter(function(m){return isThisWeek(m.date);}).length} captured</Text></TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setQuickAction&&setQuickAction({action:'focus_goals',nonce:Date.now()});navigation.navigate('Finance');}} style={[z.row,{justifyContent:'space-between',marginBottom:8}]}><Text style={z.sub}>Goals</Text><Text style={z.fv}>{goals.length} active</Text></TouchableOpacity>
      {familyBonusPts>0 && <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setScoreScope({scope:'family'});}} style={[z.row,{justifyContent:'space-between',marginBottom:8}]}><Text style={z.sub}>Family bonuses</Text><Text style={[z.fv,{color:'#BA7517'}]}>+{familyBonusPts} pts</Text></TouchableOpacity>}
      <View style={z.hDiv}/>
      {/* FA14: tap family score to open same breakdown */}
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setScoreScope({scope:'family'});}} style={{alignItems:'center',marginTop:12}}><Text style={z.fScLbl}>Your family\u2019s score this week</Text><Text style={[z.fScNum,{fontSize:28}]}>{'\u2605'}  {fmt(totalScore)}</Text></TouchableOpacity>
    </View>

    <Sec>Goals you\u2019re chasing together</Sec>
    <Text style={[z.cap,{marginBottom:8}]}>Family goals are created from Finance \u2014 choose &quot;Shared Family Goal&quot; there.</Text>
    {(sharedGoals||[]).map(function(g){
      var pct=g.target_amount>0?Math.round((Number(g.current_amount||0)/Number(g.target_amount))*100):0;
      var contribs=(sharedGoalContributions||[]).filter(function(c){return c.shared_goal_id===g.id;});
      var byUser={};
      contribs.forEach(function(c){var key=c.user_name||'Member';byUser[key]=(byUser[key]||0)+Number(c.amount||0);});
      return <View key={g.id} style={[z.card,{marginBottom:10,borderColor:pct>=100?'#0F6E56':'#E0E0DB'}]}>
        <View style={[z.row,{justifyContent:'space-between'}]}><Text style={z.txM}>{g.goal_name}</Text><Text style={[z.fv,{color:pct>=100?'#0F6E56':'#BA7517'}]}>{pct}%</Text></View>
        <Text style={z.cap}>₹{fmt(g.current_amount||0)} / ₹{fmt(g.target_amount||0)} · {g.category||'General'}</Text>
        <Bar pct={Math.min(pct,100)} color={pct>=100?'#0F6E56':'#EF9F27'} h={8}/>
        {pct>=100&&<Text style={[z.cap,{color:'#0F6E56',marginTop:4}]}>🎉 Goal completed!</Text>}
        {/* FA16: each contributor line is tappable \u2192 that member's detail */}
        <View style={{marginTop:8}}>{Object.keys(byUser).slice(0,3).map(function(u){var matchM=(members||[]).find(function(m){return m.name===u;});return <TouchableOpacity key={u} activeOpacity={0.7} onPress={function(){if(matchM){haptic('light');setMemberDetail(matchM);}}}><Text style={[z.cap,{color:matchM?theme.primary:theme.muted,fontWeight:matchM?'600':'400'}]}>{u}: ₹{fmt(byUser[u])}{matchM?' \u203A':''}</Text></TouchableOpacity>;})}</View>
        <View style={[z.row,{gap:8,marginTop:10}]}> 
          <TouchableOpacity style={[z.bSec,{flex:1}]} onPress={function(){setActiveSharedGoal(g);setShowSharedGoalModal(true);}}><Text style={z.bSecT}>Edit</Text></TouchableOpacity>
          <TouchableOpacity style={[z.bPri,{flex:1}]} onPress={function(){setContributeGoal(g);}}><Text style={z.bPriT}>Add to this</Text></TouchableOpacity>
        </View>
      </View>;
    })}
    {(!sharedGoals||sharedGoals.length===0)&&<Text style={z.cap}>No shared goals yet. The Finance tab is where they start.</Text>}

    <Sec>What\u2019s been happening</Sec>
    <View style={[z.row,{justifyContent:'space-between',marginBottom:8}]}> 
      <TouchableOpacity style={[z.bSec,{flex:1,marginRight:8}]} onPress={function(){haptic('light');setActivityFilterDate(new Date());}}><Text style={z.bSecT}>Today</Text></TouchableOpacity>
      <TouchableOpacity style={[z.bSec,{flex:1,marginRight:8}]} onPress={function(){haptic('light');setActivityFilterDate(addDays(new Date(),-1));}}><Text style={z.bSecT}>Yesterday</Text></TouchableOpacity>
      <TouchableOpacity style={[z.bSec,{flex:1}]} onPress={function(){setShowActivityDatePicker(true);}}><Text style={z.bSecT}>{displayDate(activityFilterDate)} 📅</Text></TouchableOpacity>
    </View>
    {showActivityDatePicker&&<DateField label="Filter activity date" value={activityFilterDate} onChange={function(d){setActivityFilterDate(d);setShowActivityDatePicker(false);}} maximumDate={new Date()}/>}
    {filteredActivities.slice(0,30).map(function(a){return <View key={a.id} style={[z.card,{marginBottom:6,backgroundColor:'#FFF'}]}><Text style={z.body}>{buildActivityMessage(a)}</Text><Text style={z.cap}>{relativeTime(a.created_at)}</Text></View>;})}
    {filteredActivities.length===0&&<View style={z.card}><Text style={z.cap}>Nothing happened in your family on {displayDate(activityFilterDate)}.</Text><Text style={[z.cap,{marginTop:6}]}>Try another date from the filter.</Text></View>}

    <View style={{height:32}}/></ScrollView></View>);
}

// B7: Invite sheet — shown to admin when they tap "Invite [Name]". Generates a 6-char code
// tied to that member slot, copies to clipboard, and offers native share sheet.
function InviteModal({member,familyId,familyName,onClose}){
  var[code,setCode]=useState('');
  var[loading,setLoading]=useState(false);

  async function generate(){
    haptic('light');
    setLoading(true);
    try{
      var newCode=generateInviteCode();
      var existing=await supabase.from('family_invites').select('id').eq('family_id',familyId).eq('invited_member_name',member.name).eq('status','pending').maybeSingle();
      if(existing&&existing.data&&existing.data.id){
        var upd=await supabase.from('family_invites').update({invite_code:newCode}).eq('id',existing.data.id);
        if(upd.error)throw upd.error;
      }else{
        var ins=await supabase.from('family_invites').insert({
          family_id:familyId,
          invited_by:member.userId||null,
          invite_code:newCode,
          invited_member_name:member.name||'Member',
          invited_member_role:(member.role||'parent').toLowerCase(),
          status:'pending',
        });
        if(ins.error)throw ins.error;
      }
      setCode(newCode);
      haptic('success');
    }catch(e){haptic('error');Alert.alert('Error',e.message||'Could not generate invite code');}
    setLoading(false);
  }

  async function shareCode(){
    haptic('light');
    try{
      var msg='Join the '+familyName+' family. Invite code: '+code;
      await Share.share({message:msg});
    }catch(e){console.log('[SHARE ERROR]',e);}
  }

  function copyCode(){
    haptic('light');
    try{Clipboard.setString(code);Alert.alert('Copied','Invite code copied to clipboard.');}catch(e){}
  }

  return(<Modal visible={true} animationType="slide" transparent><View style={z.modalWrap}><View style={z.modal}>
    <Text style={z.h1}>Invite {member.name}</Text>
    <Text style={[z.body,{color:'#555',marginBottom:16}]}>Share this code with {member.name}.</Text>
    {code?<View>
      <View style={[z.card,{alignItems:'center',paddingVertical:20,marginBottom:12}]}>
        <Text style={[z.caps,{marginBottom:8}]}>Invite Code</Text>
        <Text style={{fontSize:32,fontWeight:'500',letterSpacing:4,color:'#085041'}}>{code}</Text>
      </View>
      <View style={[z.row,{gap:8,marginBottom:12}]}>
        <TouchableOpacity style={[z.bSec,{flex:1}]} onPress={copyCode}><Text style={z.bSecT}>Copy Code</Text></TouchableOpacity>
        <TouchableOpacity style={[z.bPri,{flex:1}]} onPress={shareCode}><Text style={z.bPriT}>Share</Text></TouchableOpacity>
      </View>
      <TouchableOpacity onPress={generate} disabled={loading} style={{alignItems:'center'}}><Text style={[z.linkTx,{color:'#888'}]}>{loading?'Generating...':'Generate a new code'}</Text></TouchableOpacity>
    </View>:<TouchableOpacity style={z.bPri} onPress={generate} disabled={loading}><Text style={z.bPriT}>{loading?'Generating...':'Generate Invite Code'}</Text></TouchableOpacity>}
    <TouchableOpacity style={[z.bSec,{marginTop:16}]} onPress={onClose}><Text style={z.bSecT}>Close</Text></TouchableOpacity>
  </View></View></Modal>);
}

// B7: Settings screen — opened from the Home header. Contains the Family admin panel.
// ═══════════════════════════════════════════════════════════════
// OUR PROMISE — single-screen manifesto explaining what makes this
// app different. Anti-engagement stance, family-as-unit framing,
// becoming-unnecessary as a goal.
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// REUSABLE INTERACTIVE MODALS
// Added as part of the interactivity pass — these are the small
// sheets that fire when previously-static numbers/cards are tapped.
// ═══════════════════════════════════════════════════════════════

// Rename family — admin-only sheet, used from Family header and Settings family card
function RenameFamilyModal({visible,onClose,familyId,currentName,onRenamed}){
  var theme=useThemeColors();
  var[name,setName]=useState(currentName||'');
  var[saving,setSaving]=useState(false);
  useEffect(function(){if(visible)setName(currentName||'');},[visible,currentName]);
  async function save(){
    if(!name.trim()||saving)return;
    setSaving(true);
    try{
      var{error}=await supabase.from('families').update({family_name:name.trim()}).eq('id',familyId);
      if(error)throw error;
      haptic('success');
      onRenamed&&onRenamed(name.trim());
      onClose();
    }catch(e){haptic('error');showFriendlyError('Could not rename family',e);}
    finally{setSaving(false);}
  }
  return(<Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={[z.modalWrap,{justifyContent:'center'}]}>
      <View style={[z.modal,{margin:20,backgroundColor:theme.surface}]}>
        <Text style={[z.h1,{color:theme.text}]}>Rename your family</Text>
        <Inp label="Family name" value={name} onChangeText={setName} placeholder="Our Family" maxLength={48}/>
        <View style={[z.row,{gap:8,marginTop:8}]}>
          <TouchableOpacity style={[z.bSec,{flex:1,borderColor:theme.primary}]} onPress={onClose}><Text style={[z.bSecT,{color:theme.primary}]}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[z.bPri,{flex:1,backgroundColor:theme.primary,opacity:!name.trim()||saving?0.5:1}]} onPress={save} disabled={!name.trim()||saving}><Text style={z.bPriT}>{saving?'Saving\u2026':'Save'}</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>);
}

// Member detail — opened by tapping a member chip on Family / Settings / Wellness
// Shows weekly stats for that member + jump-to-detail buttons.
function MemberDetailModal({visible,onClose,member,onJumpProtein,onJumpScreens,onJumpStreak,onJumpScoreBreakdown,onJumpToday}){
  var theme=useThemeColors();
  var{transactions,meals,wellness,scores,streaks,memberProfiles}=useApp();
  if(!member)return null;
  var today=isoDate(new Date());
  var monday=mondayOfWeek(new Date());
  var weekTx=(transactions||[]).filter(function(t){return t.memberId===member.id&&toDate(t.date)>=monday;});
  var weekMeals=(meals||[]).filter(function(m){return m.memberId===member.id&&toDate(m.date)>=monday;});
  var todayMeals=(meals||[]).filter(function(m){return m.memberId===member.id&&isoDate(m.date)===today;});
  var todayProtein=todayMeals.reduce(function(s,m){return s+Number(m.protein||0);},0);
  var profile=(memberProfiles&&member.userId)?memberProfiles[member.userId]:null;
  var targets=calculateProteinTargets(profile&&profile.weightKg?profile.weightKg:null);
  var weekScreens=(wellness||[]).filter(function(w){return w.memberId===member.id&&toDate(w.date)>=monday;});
  var weekScreenHrs=weekScreens.reduce(function(s,w){return s+Number(w.screenHrs||w.screen_hrs||0);},0);
  var memScores=(scores||[]).filter(function(s){return s.member_id===member.id&&toDate(s.date)>=monday;});
  var weekPts=memScores.reduce(function(s,r){return s+(r.points_earned||0);},0);
  var memStreaks=(streaks||[]).filter(function(s){return s.member_id===member.id;});
  var topStreak=memStreaks.reduce(function(mx,s){return Math.max(mx,s.current_streak||0);},0);
  return(<Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={z.modalWrap}>
      <View style={[z.modal,{backgroundColor:theme.surface}]}>
        <View style={[z.row,{justifyContent:'space-between',alignItems:'center',marginBottom:14}]}>
          <View>
            <Text style={[z.h1,{color:theme.text,marginBottom:0}]}>{member.name}</Text>
            <Text style={[z.cap,{color:theme.textSecondary}]}>{getMemberRoleDisplay(member)}</Text>
          </View>
          <TouchableOpacity onPress={onClose}><Text style={{fontSize:14,fontWeight:'600',color:theme.primary}}>Done</Text></TouchableOpacity>
        </View>
        <ScrollView style={{maxHeight:520}}>
          <Text style={[z.cap,{textTransform:'uppercase',letterSpacing:0.6,fontWeight:'700',color:theme.muted,marginBottom:6}]}>This week</Text>
          <View style={[z.row,{justifyContent:'space-between',marginBottom:14,gap:10}]}>
            <View style={{flex:1,backgroundColor:theme.primaryLight,borderRadius:12,padding:14}}>
              <Text style={{fontSize:11,color:theme.primary,fontWeight:'600'}}>POINTS</Text>
              <Text style={{fontSize:22,fontWeight:'700',color:theme.primary}}>{weekPts}</Text>
            </View>
            <View style={{flex:1,backgroundColor:theme.primaryLight,borderRadius:12,padding:14}}>
              <Text style={{fontSize:11,color:theme.primary,fontWeight:'600'}}>STREAK</Text>
              <Text style={{fontSize:22,fontWeight:'700',color:theme.primary}}>{topStreak}d</Text>
            </View>
          </View>

          <TouchableOpacity onPress={function(){onJumpProtein&&onJumpProtein(member);}} style={[z.card,{marginBottom:8}]}>
            <View style={[z.row,{justifyContent:'space-between'}]}>
              <View style={{flex:1}}><Text style={z.txM}>Protein today</Text><Text style={z.cap}>Target {targets.active}g (active) \u00b7 {targets.regular}g (regular)</Text></View>
              <Text style={[z.fv,{color:todayProtein>=targets.active?theme.success:theme.warning}]}>{todayProtein}g</Text>
            </View>
            <Bar pct={targets.active>0?Math.min((todayProtein/targets.active)*100,100):0} color={todayProtein>=targets.active?theme.success:theme.warning}/>
          </TouchableOpacity>

          <TouchableOpacity onPress={function(){onJumpScreens&&onJumpScreens(member);}} style={[z.card,{marginBottom:8}]}>
            <View style={[z.row,{justifyContent:'space-between'}]}>
              <View style={{flex:1}}><Text style={z.txM}>Screen time this week</Text><Text style={z.cap}>{weekScreens.length} day{weekScreens.length===1?'':'s'} captured</Text></View>
              <Text style={z.fv}>{weekScreenHrs.toFixed(1)} hrs</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={function(){onJumpToday&&onJumpToday(member);}} style={[z.card,{marginBottom:8}]}>
            <Text style={z.txM}>Today\u2019s logs</Text>
            <Text style={z.cap}>{todayMeals.length} meal{todayMeals.length===1?'':'s'} \u00b7 {(transactions||[]).filter(function(t){return t.memberId===member.id&&isoDate(t.date)===today;}).length} entr{((transactions||[]).filter(function(t){return t.memberId===member.id&&isoDate(t.date)===today;}).length===1)?'y':'ies'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={function(){onJumpScoreBreakdown&&onJumpScoreBreakdown(member);}} style={[z.card,{marginBottom:8}]}>
            <Text style={z.txM}>Where {weekPts} points came from</Text>
            <Text style={z.cap}>Tap to see the breakdown</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={function(){onJumpStreak&&onJumpStreak(member);}} style={[z.card,{marginBottom:8}]}>
            <Text style={z.txM}>Streak history</Text>
            <Text style={z.cap}>Best running streak: {topStreak} days</Text>
          </TouchableOpacity>

          <View style={{height:18}}/>
        </ScrollView>
      </View>
    </View>
  </Modal>);
}

// Score breakdown — used from Family big-star card and "How this week looked" Family Score
function ScoreBreakdownModal({visible,onClose,scope,member}){
  var theme=useThemeColors();
  var{scores,members}=useApp();
  var monday=mondayOfWeek(new Date());
  var rows=(scores||[]).filter(function(s){
    if(toDate(s.date)<monday)return false;
    if(scope==='family')return true;
    if(scope==='member'&&member)return s.member_id===member.id;
    return true;
  });
  // Group by event_type
  var byType={};
  rows.forEach(function(r){
    var key=r.event_type||'other';
    if(!byType[key])byType[key]={pts:0,count:0};
    byType[key].pts+=(r.points_earned||0);
    byType[key].count+=1;
  });
  var typeKeys=Object.keys(byType).sort(function(a,b){return byType[b].pts-byType[a].pts;});
  var totalPts=rows.reduce(function(s,r){return s+(r.points_earned||0);},0);
  var memberLookup={};(members||[]).forEach(function(m){memberLookup[m.id]=m.name;});
  var nicelabel={
    all_tx_confirmed:'Confirmed all transactions',
    meal_logged:'Logged a meal',
    transaction_logged:'Logged a transaction',
    screen_time_logged:'Logged screen time',
    water_logged:'Logged water',
    streak_bonus:'Streak bonus',
    family_bonus:'Family bonus',
    other:'Other',
  };
  return(<Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={z.modalWrap}>
      <View style={[z.modal,{backgroundColor:theme.surface,maxHeight:'80%'}]}>
        <View style={[z.row,{justifyContent:'space-between',alignItems:'center',marginBottom:10}]}>
          <View>
            <Text style={[z.h1,{color:theme.text,marginBottom:0}]}>Score breakdown</Text>
            <Text style={[z.cap,{color:theme.textSecondary}]}>{scope==='family'?'Whole family this week':((member&&member.name)||'Member')+' \u00b7 this week'}</Text>
          </View>
          <TouchableOpacity onPress={onClose}><Text style={{fontSize:14,fontWeight:'600',color:theme.primary}}>Done</Text></TouchableOpacity>
        </View>
        <View style={{borderRadius:14,backgroundColor:theme.primaryLight,padding:14,marginBottom:14}}>
          <Text style={{fontSize:11,fontWeight:'600',color:theme.primary,letterSpacing:0.6}}>TOTAL</Text>
          <Text style={{fontSize:30,fontWeight:'700',color:theme.primary}}>{fmt(totalPts)} pts</Text>
        </View>
        <ScrollView style={{maxHeight:420}}>
          {typeKeys.length===0&&<Text style={z.cap}>Nothing earned yet this week.</Text>}
          {typeKeys.map(function(k){return<View key={k} style={[z.card,{marginBottom:8}]}>
            <View style={[z.row,{justifyContent:'space-between'}]}>
              <View style={{flex:1}}><Text style={z.txM}>{nicelabel[k]||k}</Text><Text style={z.cap}>{byType[k].count} time{byType[k].count===1?'':'s'}</Text></View>
              <Text style={[z.fv,{color:theme.primary}]}>+{byType[k].pts}</Text>
            </View>
          </View>;})}
          <View style={{height:18}}/>
        </ScrollView>
      </View>
    </View>
  </Modal>);
}

// Quick category change — fired by tapping a category Pill on a transaction
function CategoryQuickPickModal({visible,onClose,transaction}){
  var theme=useThemeColors();
  var{upsertTransactionLocal,refreshTransactions}=useApp();
  var[saving,setSaving]=useState(false);
  if(!transaction)return null;
  async function pick(cat){
    if(saving)return;
    setSaving(true);
    try{
      var{data,error}=await supabase.from('transactions').update({category:cat}).eq('id',transaction.id).select().single();
      if(error)throw error;
      upsertTransactionLocal&&upsertTransactionLocal(normTransactions([data])[0]);
      await refreshTransactions&&refreshTransactions();
      haptic('success');
      onClose();
    }catch(e){haptic('error');showFriendlyError('Could not change category',e);}
    finally{setSaving(false);}
  }
  return(<Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={[z.modalWrap,{justifyContent:'flex-end'}]}>
      <View style={[z.modal,{backgroundColor:theme.surface}]}>
        <Text style={[z.h1,{color:theme.text}]}>Change category</Text>
        <Text style={[z.cap,{marginBottom:12,color:theme.textSecondary}]}>{transaction.merchant} \u00b7 {'\u20B9'}{fmt(transaction.amount)}</Text>
        <View style={[z.row,{flexWrap:'wrap',gap:8,marginBottom:14}]}>
          {CAT_LIST.map(function(c){
            var sel=transaction.category===c;
            return <TouchableOpacity key={c} style={[z.chip,sel&&z.chipSel,{opacity:saving?0.5:1}]} disabled={saving} onPress={function(){haptic('light');pick(c);}}>
              <Text style={[z.chipTx,sel&&z.chipSelTx]}>{c}</Text>
            </TouchableOpacity>;
          })}
        </View>
        <TouchableOpacity style={[z.bSec,{borderColor:theme.primary}]} onPress={onClose}><Text style={[z.bSecT,{color:theme.primary}]}>Close</Text></TouchableOpacity>
      </View>
    </View>
  </Modal>);
}

// Trend detail — full-screen view of spend or protein trend
function TrendDetailModal({visible,onClose,kind,data,labels}){
  var theme=useThemeColors();
  if(!visible)return null;
  var width=Math.min(Dimensions.get('window').width-40,360);
  var title=kind==='spend'?'Where spending is heading':'Where protein is heading';
  var unit=kind==='spend'?'\u20B9':'g';
  var max=Math.max.apply(null,(data||[0]).concat([1]));
  var avg=data&&data.length?Math.round(data.reduce(function(a,b){return a+b;},0)/data.length):0;
  return(<Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={z.modalWrap}>
      <View style={[z.modal,{backgroundColor:theme.surface,maxHeight:'80%'}]}>
        <View style={[z.row,{justifyContent:'space-between',alignItems:'center',marginBottom:14}]}>
          <Text style={[z.h1,{color:theme.text,marginBottom:0}]}>{title}</Text>
          <TouchableOpacity onPress={onClose}><Text style={{fontSize:14,fontWeight:'600',color:theme.primary}}>Done</Text></TouchableOpacity>
        </View>
        <View style={[z.card,{backgroundColor:theme.card}]}>
          <Text style={[z.cap,{textTransform:'uppercase',letterSpacing:0.5,fontWeight:'700',color:theme.muted,marginBottom:6}]}>Daily average over 7 days</Text>
          <Text style={{fontSize:30,fontWeight:'700',color:theme.text,marginBottom:14}}>{unit}{fmt(avg)}{kind==='protein'?'':''}</Text>
          <LineChart
            data={{labels:labels||[],datasets:[{data:data||[0]}]}}
            width={width}
            height={200}
            yAxisLabel={kind==='spend'?'\u20B9':''}
            yAxisSuffix={kind==='protein'?'g':''}
            withInnerLines={false}
            chartConfig={{backgroundGradientFrom:'#FFFFFF',backgroundGradientTo:'#FFFFFF',decimalPlaces:0,color:function(){return '#085041';},labelColor:function(){return '#555';},propsForDots:{r:'3',strokeWidth:'1.5',stroke:'#085041'}}}
            bezier
            style={{borderRadius:8}}
          />
          <Text style={[z.cap,{marginTop:10,color:theme.textSecondary}]}>Peak: {unit}{fmt(max)}</Text>
        </View>
      </View>
    </View>
  </Modal>);
}

function OurPromiseScreen({onClose}){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  return(<View style={[z.scr,{paddingTop:ins.top,backgroundColor:theme.background}]}>
    <View style={[z.row,{justifyContent:'space-between',paddingHorizontal:20,paddingTop:8,paddingBottom:16}]}>
      <Text style={[z.h1,{color:theme.text}]}>Our Promise</Text>
      <TouchableOpacity onPress={function(){haptic('light');onClose();}} style={{paddingHorizontal:8,paddingVertical:4}}><Text style={{fontSize:16,fontWeight:'600',color:theme.primary}}>Done</Text></TouchableOpacity>
    </View>
    <ScrollView style={z.fl} contentContainerStyle={{paddingHorizontal:24,paddingBottom:60}} showsVerticalScrollIndicator={false}>
      <Text style={{fontSize:22,fontWeight:'600',color:theme.text,lineHeight:30,marginBottom:24,letterSpacing:-0.3}}>
        We are not here to keep your attention. We are here to give it back.
      </Text>

      <View style={{height:1,backgroundColor:theme.border,marginVertical:8}}/>

      <Text style={{fontSize:13,fontWeight:'600',color:theme.accent,letterSpacing:1.2,textTransform:'uppercase',marginTop:20,marginBottom:8}}>One</Text>
      <Text style={{fontSize:18,fontWeight:'500',color:theme.text,lineHeight:26,marginBottom:6}}>Your family is the unit. Not you alone.</Text>
      <Text style={{fontSize:14,color:theme.textSecondary,lineHeight:22,marginBottom:20}}>
        Every other app gives each person a separate dashboard. Yours shows the whole family at once — money, meals, time, goals — so you can finally see the picture instead of guessing at it.
      </Text>

      <Text style={{fontSize:13,fontWeight:'600',color:theme.accent,letterSpacing:1.2,textTransform:'uppercase',marginTop:12,marginBottom:8}}>Two</Text>
      <Text style={{fontSize:18,fontWeight:'500',color:theme.text,lineHeight:26,marginBottom:6}}>One nudge a day. Never between 10 PM and 8 AM.</Text>
      <Text style={{fontSize:14,color:theme.textSecondary,lineHeight:22,marginBottom:20}}>
        No streaks designed to break you. No gamification. No re-prompts. If you miss a day, the day passes. We will not pull you back into the app to fix a number.
      </Text>

      <Text style={{fontSize:13,fontWeight:'600',color:theme.accent,letterSpacing:1.2,textTransform:'uppercase',marginTop:12,marginBottom:8}}>Three</Text>
      <Text style={{fontSize:18,fontWeight:'500',color:theme.text,lineHeight:26,marginBottom:6}}>We are trying to become unnecessary.</Text>
      <Text style={{fontSize:14,color:theme.textSecondary,lineHeight:22,marginBottom:20}}>
        After six months you should know your family's spending patterns, eating patterns, and screen patterns by heart. The habits should outlive the app. If they do, we did our job — even if you stop opening this.
      </Text>

      <View style={{height:1,backgroundColor:theme.border,marginVertical:24}}/>

      <Text style={{fontSize:14,color:theme.textSecondary,lineHeight:22,marginBottom:6,fontStyle:'italic'}}>
        This app is not a tracker. It is a mirror.
      </Text>
      <Text style={{fontSize:14,color:theme.textSecondary,lineHeight:22,marginBottom:40,fontStyle:'italic'}}>
        Trackers tell you what happened. A mirror shows you what you didn't know was there.
      </Text>
    </ScrollView>
  </View>);
}

function SettingsScreen({onClose}){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var themeCtx=useThemeCtx();
  var themeMode=themeCtx&&themeCtx.themeMode?themeCtx.themeMode:'light';
  var setThemeMode=themeCtx&&themeCtx.setThemeMode?themeCtx.setThemeMode:function(){};
  var{familyId,familyName,setFamilyName,members,isAdmin,userId,currentUserName,userProfile,refreshMembers,openQuestionnaire,notificationEnabled,setNotificationEnabled,waterTrackingEnabled,setWaterTrackingEnabled,refreshActivityFeed}=useApp();
  var[inviteSheet,setInviteSheet]=useState(null);
  var[removeConfirm,setRemoveConfirm]=useState(null);
  var[showProfile,setShowProfile]=useState(false);
  var[showOurPromise,setShowOurPromise]=useState(false);
  var[showRename,setShowRename]=useState(false); // S3
  var[memberDetail,setMemberDetail]=useState(null); // S4
  var[debugTaps,setDebugTaps]=useState(0);
  var[debugEnabled,setDebugEnabled]=useState(false);
  var creatorMember=(members||[]).find(function(m){return m.userId===userId;})||((isAdmin&&members&&members.length)?members[0]:null);
  var creatorMemberId=creatorMember?creatorMember.id:null;
  var userInitials=(currentUserName||'?').trim().split(' ').filter(Boolean).slice(0,2).map(function(s){return s.charAt(0).toUpperCase();}).join('')||'?';

  async function removeMember(m){
    try{
      var{data,error}=await supabase.from('family_members').delete().eq('id',m.id).select();
      console.log('[MEMBER UNLINK]',{memberId:m.id,data:data,error:error});
      if(error)throw error;
      await refreshMembers();
      haptic('success');
      setRemoveConfirm(null);
    }catch(e){haptic('error');showFriendlyError('Could not update family member',e);}
  }

  return(<View style={[z.scr,{paddingTop:ins.top,backgroundColor:theme.background}]}> 
    {inviteSheet&&<InviteModal member={inviteSheet} familyId={familyId} familyName={familyName} onClose={function(){setInviteSheet(null);}}/>}
    <ProfileModal visible={showProfile} onClose={function(){setShowProfile(false);}}/>
    {showOurPromise&&<Modal visible={true} animationType="slide" onRequestClose={function(){setShowOurPromise(false);}}><OurPromiseScreen onClose={function(){setShowOurPromise(false);}}/></Modal>}
    <RenameFamilyModal visible={showRename} onClose={function(){setShowRename(false);}} familyId={familyId} currentName={familyName} onRenamed={function(newName){setFamilyName&&setFamilyName(newName);}}/>
    <MemberDetailModal visible={!!memberDetail} member={memberDetail} onClose={function(){setMemberDetail(null);}}
      onJumpProtein={function(){setMemberDetail(null);onClose&&onClose();}}
      onJumpScreens={function(){setMemberDetail(null);onClose&&onClose();}}
      onJumpStreak={function(){setMemberDetail(null);onClose&&onClose();}}
      onJumpScoreBreakdown={function(){setMemberDetail(null);onClose&&onClose();}}
      onJumpToday={function(){setMemberDetail(null);onClose&&onClose();}}
    />
    {removeConfirm&&<Modal visible={true} transparent animationType="fade"><View style={[z.modalWrap,{justifyContent:'center'}]}><View style={[z.modal,{margin:20,backgroundColor:theme.surface}]}>
      <Text style={[z.h1,{color:theme.text}]}>Remove {removeConfirm.name}?</Text>
      <Text style={[z.body,{marginBottom:16,color:theme.textSecondary}]}>This unlinks their account. Their existing logs stay in the family history.</Text>
      <View style={z.row}><TouchableOpacity style={[z.bSec,{flex:1,marginRight:8,borderColor:theme.primary}]} onPress={function(){setRemoveConfirm(null);}}><Text style={[z.bSecT,{color:theme.primary}]}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[z.bPri,{flex:1,backgroundColor:theme.danger}]} onPress={function(){removeMember(removeConfirm);}}><Text style={z.bPriT}>Remove</Text></TouchableOpacity></View>
    </View></View></Modal>}
    <View style={[z.row,{justifyContent:'space-between',paddingHorizontal:20,paddingTop:8,paddingBottom:16}]}>
      <Text style={[z.h1,{color:theme.text}]}>Settings</Text>
      <TouchableOpacity onPress={function(){haptic('light');onClose();}} style={{paddingHorizontal:8,paddingVertical:4}}><Text style={{fontSize:16,fontWeight:'600',color:theme.primary}}>Done</Text></TouchableOpacity>
    </View>
    <ScrollView style={z.fl} contentContainerStyle={z.pad} showsVerticalScrollIndicator={false}>
      {/* Profile card */}
      <TouchableOpacity onPress={function(){setShowProfile(true);}} style={{flexDirection:'row',alignItems:'center',backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:18,padding:16,marginBottom:14}}>
        <View style={[z.profileAvatar,{backgroundColor:theme.primaryLight,borderColor:theme.border}]}>
          <Text style={[z.profileAvatarTx,{color:theme.primary}]}>{userInitials}</Text>
        </View>
        <View style={{flex:1,marginLeft:14}}>
          <Text style={{fontSize:16,fontWeight:'700',color:theme.text}}>{currentUserName||'User'}</Text>
          <Text style={{fontSize:12,color:theme.textSecondary,marginTop:2}}>{userProfile&&userProfile.email?userProfile.email:''}</Text>
          {isAdmin&&<View style={{marginTop:6,backgroundColor:theme.accentLight,borderRadius:8,paddingVertical:3,paddingHorizontal:8,alignSelf:'flex-start'}}>
            <Text style={{fontSize:11,fontWeight:'700',color:theme.accent,letterSpacing:0.3}}>{'\uD83D\uDC51'} FAMILY ADMIN</Text>
          </View>}
        </View>
        <Text style={{fontSize:18,color:theme.muted}}>{'\u203A'}</Text>
      </TouchableOpacity>

      {/* App Theme */}
      <Sec>App Theme</Sec>
      <View style={{flexDirection:'row',backgroundColor:theme.surfaceElevated,borderRadius:14,padding:4,marginBottom:8}}>
        {[{key:'light',label:'Light'},{key:'dark',label:'Dark'},{key:'system',label:'System'}].map(function(opt){
          var sel=themeMode===opt.key;
          return <TouchableOpacity key={'tm_'+opt.key} style={{flex:1,paddingVertical:10,alignItems:'center',borderRadius:10,backgroundColor:sel?theme.surface:'transparent'}} onPress={function(){haptic('light');setThemeMode(opt.key);}}>
            <Text style={{fontSize:13,fontWeight:'600',color:sel?theme.primary:theme.textSecondary}}>{opt.label}</Text>
          </TouchableOpacity>;
        })}
      </View>
      <Text style={[z.cap,{color:theme.muted,marginBottom:8}]}>System follows your device\u2019s appearance setting.</Text>

      <Sec>Family</Sec>
      {/* S3: tap family card (admin) to rename */}
      <TouchableOpacity activeOpacity={isAdmin?0.7:1} onPress={function(){if(isAdmin){haptic('light');setShowRename(true);}}} style={[z.card,{marginBottom:8,backgroundColor:theme.card,borderColor:theme.border}]}><Text style={[z.txM,{color:theme.text}]}>{familyName}{isAdmin?' \u270E':''}</Text><Text style={[z.cap,{color:theme.muted}]}>{members.length} member{members.length!==1?'s':''}</Text><Text style={[z.cap,{marginTop:4,color:theme.muted}]}>Signed in as {currentUserName||'User'}</Text>{isAdmin&&<Text style={[z.cap,{color:theme.primary,marginTop:4,fontWeight:'600'}]}>You are the Family Admin</Text>}</TouchableOpacity>
      {members.map(function(m){
        var isSelf=m.userId===userId||m.id===creatorMemberId;
        var status=isSelf?'You':(m.userId?'Joined':(m.inviteCode?'Invite pending':'Not invited'));
        var statusColor=isSelf?theme.primary:(m.userId?theme.primary:(m.inviteCode?theme.accent:theme.muted));
        var roleLabel=getMemberRoleDisplay(m);
        return<TouchableOpacity key={m.id} activeOpacity={0.7} onPress={function(){if(isSelf){haptic('light');setShowProfile(true);}else{haptic('light');setMemberDetail(m);}}} style={[z.card,{marginBottom:8}]}> 
        <View style={[z.row,{justifyContent:'space-between',alignItems:'center'}]}>
          <View style={{flex:1}}><Text style={z.txM}>{m.name}</Text><Text style={z.cap}>{roleLabel}</Text></View>
          <Text style={[z.cap,{color:statusColor,fontWeight:'500'}]}>{status}</Text>
        </View>
        {isAdmin && !m.userId && m.id!==creatorMemberId && <View style={[z.row,{marginTop:12,gap:8}]}>
          <TouchableOpacity style={[z.bSec,{flex:1}]} onPress={function(){setInviteSheet(m);}}><Text style={z.bSecT}>{m.inviteCode?'Regenerate Code':'Invite'}</Text></TouchableOpacity>
        </View>}
        {isAdmin && m.userId && m.userId!==userId && <TouchableOpacity style={{marginTop:12,alignSelf:'flex-start'}} onPress={function(){setRemoveConfirm(m);}}><Text style={[z.cap,{color:'#E24B4A',fontWeight:'500'}]}>Remove from family</Text></TouchableOpacity>}
      </TouchableOpacity>;})}
      <Sec>About you</Sec>
      <TouchableOpacity style={[z.card,{marginBottom:8}]} onPress={function(){setShowProfile(true);}}>
        <Text style={z.txM}>Your profile</Text>
        <Text style={z.cap}>Avatar, personal details, privacy controls</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[z.card,{marginBottom:8}]} onPress={function(){haptic('light');openQuestionnaire&&openQuestionnaire();}}>
        <Text style={z.txM}>Revisit your answers</Text>
        <Text style={z.cap}>Update what you told us when you joined</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[z.card,{marginBottom:8,flexDirection:'row',alignItems:'center'}]} onPress={function(){haptic('light');setShowOurPromise(true);}}>
        <Text style={{fontSize:18,marginRight:10}}>{'\uD83E\uDD1D'}</Text>
        <View style={{flex:1}}>
          <Text style={z.txM}>Our Promise</Text>
          <Text style={z.cap}>Why this app is different from a tracker</Text>
        </View>
        <Text style={{fontSize:18,color:theme.muted}}>{'\u203A'}</Text>
      </TouchableOpacity>

      <Sec>How the app behaves</Sec>
      <View style={[z.card,{marginBottom:8}]}> 
        <View style={[z.row,{justifyContent:'space-between'}]}>
          <View style={{flex:1,paddingRight:10}}><Text style={z.txM}>Evening reminders</Text><Text style={z.cap}>Smart reminder at 8 PM if today is incomplete</Text></View>
          <Switch value={notificationEnabled} onValueChange={async function(next){setNotificationEnabled&&setNotificationEnabled(next);try{await supabase.from('users').update({notification_enabled:next}).eq('id',userId);}catch(e){}}}/>
        </View>
      </View>
      <View style={[z.card,{marginBottom:8}]}> 
        <View style={[z.row,{justifyContent:'space-between'}]}>
          <View style={{flex:1,paddingRight:10}}><Text style={z.txM}>Show water tracking</Text><Text style={z.cap}>Adds water entry to Wellness. Off by default.</Text></View>
          <Switch value={waterTrackingEnabled} onValueChange={async function(next){setWaterTrackingEnabled&&setWaterTrackingEnabled(next);try{await supabase.from('users').update({water_tracking_enabled:next}).eq('id',userId);}catch(e){}}}/>
        </View>
      </View>

      <Sec>Your data</Sec>
      <TouchableOpacity style={[z.card,{marginBottom:8}]} onPress={async function(){
        try{
          await refreshActivityFeed&&refreshActivityFeed();
          Alert.alert('Refreshed','Synced latest family activity.');
        }catch(e){
          showFriendlyError('Could not refresh data',e);
        }
      }}>
        <Text style={z.txM}>Pull latest from cloud</Text>
        <Text style={z.cap}>Sync the latest comments, goals, and family activity</Text>
      </TouchableOpacity>

      <Sec>Under the hood</Sec>
      <TouchableOpacity style={[z.card,{marginBottom:8}]} onPress={function(){var n=debugTaps+1;setDebugTaps(n);if(n>=7){setDebugEnabled(true);Alert.alert('Debug mode','Developer options unlocked for this session.');}}}><Text style={z.txM}>App Version</Text><Text style={z.cap}>v1.0.0 · Tap 7 times to unlock debug options</Text></TouchableOpacity>
      {debugEnabled&&<View style={[z.card,{marginBottom:8,backgroundColor:'#F2F2EE'}]}><Text style={z.cap}>Debug enabled</Text><Text style={z.cap}>User: {userId}</Text><Text style={z.cap}>Family: {familyId}</Text><Text style={z.cap}>Members: {members.length}</Text></View>}

      <TouchableOpacity style={[z.card,{marginBottom:8}]} onPress={async function(){
        haptic('light');
        try{
          if(userProfile&&userProfile.user_type==='member'){
            await supabase.from('family_members').delete().eq('family_id',familyId).eq('user_id',userId);
            await supabase.from('users').update({family_id:null}).eq('id',userId);
          }
        }catch(e){console.log('[MEMBER LOGOUT RESET ERROR]',e);} 
        supabase.auth.signOut();
      }}>
        <Text style={[z.txM,{color:'#E24B4A'}]}>Sign Out</Text>
      </TouchableOpacity>
      <View style={{height:32}}/>
    </ScrollView>
  </View>);
}

// ═══════════════════════════════════════════════════════════════
// FLOATING TAB BAR — pill nav with Family centered as hero
// Order: Home | Finance | Family (raised) | Wellness | Insights
// ═══════════════════════════════════════════════════════════════
function FloatingTabBar(props){
  var state=props.state;
  var navigation=props.navigation;
  var insets=useSafeAreaInsets();
  var theme=useThemeColors();
  var icons={Home:'\u2302',Finance:'\u20B9',Wellness:'\u2661',Insights:'\u25CE',Family:'\u2665'};

  function renderTab(routeName,iconChar,focused,onPress){
    return (
      <TouchableOpacity
        key={'tab_'+routeName}
        style={{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:8}}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={routeName}
      >
        <Text style={{fontSize:22,color:focused?theme.primary:theme.muted,marginBottom:2}}>{iconChar}</Text>
        <Text style={{fontSize:10,fontWeight:focused?'700':'500',color:focused?theme.primary:theme.muted,letterSpacing:0.2}}>{routeName}</Text>
      </TouchableOpacity>
    );
  }

  // Build a navigation-friendly index lookup keyed by name (route order in Tab.Navigator may differ)
  var routeIndex={};
  state.routes.forEach(function(r,i){routeIndex[r.name]=i;});

  function pressFor(routeName){
    return function(){
      var idx=routeIndex[routeName];
      if(idx==null)return;
      var route=state.routes[idx];
      var event=navigation.emit({type:'tabPress',target:route.key,canPreventDefault:true});
      if(state.index!==idx&&!event.defaultPrevented){
        haptic('light');
        navigation.navigate(route.name);
      }
    };
  }

  function isFocused(routeName){return state.routes[state.index]&&state.routes[state.index].name===routeName;}

  return (
    <View pointerEvents="box-none" style={{position:'absolute',left:0,right:0,bottom:0,paddingBottom:Math.max(insets.bottom,8),paddingHorizontal:16,backgroundColor:'transparent'}}>
      <View style={{
        flexDirection:'row',
        backgroundColor:theme.navBarBg,
        borderRadius:32,
        height:64,
        alignItems:'center',
        paddingHorizontal:8,
        shadowColor:'#000',
        shadowOffset:{width:0,height:8},
        shadowOpacity:0.12,
        shadowRadius:18,
        elevation:10,
        borderWidth:1,
        borderColor:theme.border,
      }}>
        {renderTab('Home',icons.Home,isFocused('Home'),pressFor('Home'))}
        {renderTab('Finance',icons.Finance,isFocused('Finance'),pressFor('Finance'))}

        {/* Center hero: Family — raised circle */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Family"
          onPress={pressFor('Family')}
          style={{width:64,alignItems:'center',justifyContent:'center'}}
        >
          <View style={{
            width:58,height:58,borderRadius:29,
            backgroundColor:theme.primary,
            alignItems:'center',justifyContent:'center',
            marginTop:-26,
            shadowColor:theme.primary,shadowOffset:{width:0,height:6},shadowOpacity:0.35,shadowRadius:10,elevation:8,
            borderWidth:4,borderColor:theme.background,
          }}>
            <Text style={{fontSize:22,color:'#FFFFFF'}}>{icons.Family}</Text>
          </View>
          <Text style={{fontSize:10,fontWeight:isFocused('Family')?'700':'600',color:isFocused('Family')?theme.primary:theme.textSecondary,letterSpacing:0.2,marginTop:2}}>Family</Text>
        </TouchableOpacity>

        {renderTab('Wellness',icons.Wellness,isFocused('Wellness'),pressFor('Wellness'))}
        {renderTab('Insights',icons.Insights,isFocused('Insights'),pressFor('Insights'))}
      </View>
    </View>
  );
}

var Tab=createBottomTabNavigator();
function MainTabs(){
  var theme=useThemeColors();
  return(
    <Tab.Navigator
      screenOptions={{
        headerShown:false,
        tabBarStyle:{display:'none'}, // hidden — FloatingTabBar replaces it
        tabBarActiveTintColor:theme.primary,
        tabBarInactiveTintColor:theme.muted,
      }}
      tabBar={function(props){return React.createElement(FloatingTabBar,props);}}
    >
      <Tab.Screen name="Home" component={HomeScreen}/>
      <Tab.Screen name="Finance" component={FinanceScreen}/>
      <Tab.Screen name="Family" component={FamilyScreen}/>
      <Tab.Screen name="Wellness" component={WellnessScreen}/>
      <Tab.Screen name="Insights" component={InsightsScreen}/>
    </Tab.Navigator>
  );
}

function AppInner(){
  var theme=useThemeColors();
  var[user,setUser]=useState(null);var[loading,setLoading]=useState(true);
  var[familyId,setFamilyId]=useState(null);var[familyName,setFamilyName]=useState('');
  var[currentUserName,setCurrentUserName]=useState('');
  var[userCreatedAt,setUserCreatedAt]=useState(null);
  var[onboarded,setOnboarded]=useState(false);
  var[members,setMembers]=useState([]);var[transactions,setTransactions]=useState([]);
  var[meals,setMeals]=useState([]);var[goals,setGoals]=useState([]);var[wellness,setWellness]=useState([]);
  var[transactionComments,setTransactionComments]=useState([]);
  var[sharedGoals,setSharedGoals]=useState([]);
  var[sharedGoalContributions,setSharedGoalContributions]=useState([]);
  var[activityFeed,setActivityFeed]=useState([]);
  var[customCategories,setCustomCategories]=useState([]);
  var[userProfile,setUserProfile]=useState(null);
  var[memberProfiles,setMemberProfiles]=useState({});
  var[todayNudge,setTodayNudge]=useState(null);
  // B6: Scoring state — loaded from family_scores and streaks tables, kept live via realtime
  var[scores,setScores]=useState([]);
  var[streaks,setStreaks]=useState([]);
  // B7: Admin flag — true if this user created the family
  var[isAdmin,setIsAdmin]=useState(false);
  var[currentScreen,setCurrentScreen]=useState('loading');
  var[currentUser,setCurrentUser]=useState(null);
  var[inviteCode,setInviteCode]=useState('');
  // Settings overlay from Home header
  var[showSettings,setShowSettings]=useState(false);
  var[showQuestionnaire,setShowQuestionnaire]=useState(false);
  var[quickAction,setQuickAction]=useState(null);
  var[nudgeHistory,setNudgeHistory]=useState([]);
  var[dismissedNudgeIds,setDismissedNudgeIds]=useState([]);
  var[recurringTransactions,setRecurringTransactions]=useState([]);
  var[notificationEnabled,setNotificationEnabled]=useState(true);
  var[waterTrackingEnabled,setWaterTrackingEnabled]=useState(false);
  var navRef=useNavigationContainerRef();

  function handleAuthSuccess(payload){
    var sessionUser=payload&&payload.sessionUser?payload.sessionUser:null;
    var userData=payload&&payload.userData?payload.userData:null;
    var nextScreen=payload&&payload.nextScreen?payload.nextScreen:'questionnaire';
    console.log('[AUTH FLOW] handleAuthSuccess',{
      hasSessionUser:!!sessionUser,
      hasUserData:!!userData,
      nextScreen:nextScreen,
      userId:sessionUser&&sessionUser.id?sessionUser.id:null,
    });
    if(sessionUser)setUser(sessionUser);
    if(userData){
      setCurrentUser(userData);
      setCurrentUserName(getDisplayName(userData,sessionUser&&sessionUser.email));
    }
    setCurrentScreen(nextScreen);
    setLoading(false);
  }

  function handleAuthRefreshRequested(){
    console.log('[AUTH FLOW] handleAuthRefreshRequested -> checkAuthState');
    checkAuthState();
  }

  // Fetch today's nudge from Supabase
  async function fetchTodayNudge(uid){
    try{
      var start=new Date();start.setHours(0,0,0,0);
      var primary=await supabase.from('nudges').select('*').eq('user_id',uid).gte('sent_at',start.toISOString()).order('sent_at',{ascending:false}).limit(1);
      var rows=primary&&primary.data?primary.data:[];
      if(primary&&primary.error){
        var fallback=await supabase.from('nudges').select('*').eq('user_id',uid).gte('created_at',start.toISOString()).order('created_at',{ascending:false}).limit(1);
        rows=fallback&&fallback.data?fallback.data:[];
      }
      if(rows&&rows.length>0){
        var n=rows[0];
        if(!n.nudge_text&&n.message)n.nudge_text=n.message;
        setTodayNudge(n);
      }else setTodayNudge(null);
    }catch(e){
      console.log('[TODAY NUDGE ERROR]',e);
      setTodayNudge(null);
    }
  }

  async function refreshNudges(uid){
    if(!(uid||user&&user.id))return[];
    var target=uid||(user&&user.id);
    var rows=[];
    var r=await supabase.from('nudges').select('*').eq('user_id',target).order('sent_at',{ascending:false}).limit(100);
    if(r.error){
      var fallback=await supabase.from('nudges').select('*').eq('user_id',target).order('created_at',{ascending:false}).limit(100);
      if(fallback.error)throw fallback.error;
      rows=fallback.data||[];
    }else rows=r.data||[];
    rows=rows.map(function(n){if(!n.nudge_text&&n.message)n.nudge_text=n.message;return n;});
    setNudgeHistory(rows);
    return rows;
  }

  async function dismissNudge(nudgeId){
    if(!nudgeId)return;
    try{
      var next=[];
      setDismissedNudgeIds(function(prev){
        var merged=[].concat((prev||[]),[nudgeId]).filter(function(v,i,a){return a.indexOf(v)===i;});
        next=merged;
        return merged;
      });
      await AsyncStorage.setItem('dismissed_nudges_'+(user&&user.id||'anon'),JSON.stringify(next));
      setNudgeHistory(function(prev){return(prev||[]).filter(function(n){return n.id!==nudgeId;});});
      if(todayNudge&&todayNudge.id===nudgeId)setTodayNudge(null);
      try{await supabase.from('nudges').update({is_dismissed:true,dismissed_at:new Date().toISOString()}).eq('id',nudgeId);}catch(e){}
    }catch(e){console.log('[DISMISS NUDGE ERROR]',e);}
  }

  useEffect(function(){
    (async function(){
      if(!user||!user.id){setDismissedNudgeIds([]);return;}
      try{
        var raw=await AsyncStorage.getItem('dismissed_nudges_'+user.id);
        var parsed=raw?JSON.parse(raw):[];
        setDismissedNudgeIds(Array.isArray(parsed)?parsed:[]);
      }catch(e){setDismissedNudgeIds([]);}
    })();
  },[user&&user.id]);


  async function refreshRecurringTransactions(fid){
    var family=fid||familyId;
    if(!family)return[];
    var r=await supabase.from('recurring_transactions').select('*').eq('family_id',family).eq('is_active',true).order('next_due_date',{ascending:true});
    if(r.error)throw r.error;
    setRecurringTransactions(r.data||[]);
    return r.data||[];
  }

  async function checkAndCreateRecurringTransactions(fid){
    var family=fid||familyId;
    if(!family||!user||!user.id)return;
    try{
      var todayISO=isoDate(new Date());
      var recurring=(await supabase.from('recurring_transactions').select('*').eq('family_id',family).eq('is_active',true)).data||[];
      for(var i=0;i<recurring.length;i++){
        var recur=recurring[i];
        var dueISO=isoDate(recur.next_due_date||new Date());
        if(dueISO!==todayISO)continue;
        var existing=await supabase.from('transactions').select('id').eq('family_id',family).eq('recurring_transaction_id',recur.id).eq('date',todayISO).maybeSingle();
        if(existing&&existing.data&&existing.data.id)continue;
        var txPayload={
          family_id:family,
          merchant:recur.description||'Recurring entry',
          amount:Number(recur.amount||0),
          category:recur.transaction_type==='income'?'Income':(recur.category||'House Bills'),
          member_id:recur.member_id||'joint',
          member_name:recur.member_name||'Joint',
          confirmed:false,
          source:'Recurring Auto',
          date:todayISO,
          recurring_transaction_id:recur.id,
        };
        var txInsert=await supabase.from('transactions').insert(txPayload).select().single();
        if(txInsert.error)throw txInsert.error;
        var nextDue=isoDate(getNextRecurringDueDate(todayISO,recur.frequency,recur.due_day));
        await supabase.from('recurring_transactions').update({next_due_date:nextDue,last_created_date:todayISO,updated_at:new Date().toISOString()}).eq('id',recur.id);
        await Notifications.scheduleNotificationAsync({
          content:{
            title:(recur.description||'Recurring transaction')+' recorded',
            body:'₹'+fmt(recur.amount||0)+' added. Tap to review or edit.',
            data:{action:'open_tx',tab:'Finance',recurring_transaction_id:recur.id},
          },
          trigger:null,
        });
      }
      await refreshTransactions(family);
      await refreshRecurringTransactions(family);
    }catch(e){console.log('[RECURRING AUTO CREATE ERROR]',e);}
  }

  // Register this device for push notifications
  async function registerPush(uid){
    if(!Device.isDevice)return;
    try{
      var{status:ex}=await Notifications.getPermissionsAsync();
      var finalStatus=ex;
      if(ex!=='granted'){var r=await Notifications.requestPermissionsAsync();finalStatus=r.status;}
      if(finalStatus!=='granted')return;
      var td=await Notifications.getExpoPushTokenAsync();
      await supabase.from('push_tokens').upsert({user_id:uid,token:td.data,platform:Platform.OS,updated_at:new Date().toISOString()});
    }catch(e){}
  }

  function getMissingForToday(){
    var summary=calcDayCompletion(familyId,new Date(),transactions,meals,wellness);
    var missing=[];
    if(!summary.flags.transaction)missing.push({action:'open_tx',tab:'Finance',label:'an entry'});
    if(!summary.flags.breakfast)missing.push({action:'open_meal',tab:'Wellness',mealType:'breakfast',label:'breakfast'});
    if(!summary.flags.lunch)missing.push({action:'open_meal',tab:'Wellness',mealType:'lunch',label:'lunch'});
    if(!summary.flags.dinner)missing.push({action:'open_meal',tab:'Wellness',mealType:'dinner',label:'dinner'});
    if(!summary.flags.screen)missing.push({action:'open_screen',tab:'Wellness',label:'screen time'});
    return missing;
  }

  useEffect(function(){
    if(!user||!familyId||!notificationEnabled)return;
    (async function(){
      try{
        var missing=getMissingForToday();
        var scheduledId=await AsyncStorage.getItem('evening_notification_id');
        if(scheduledId){
          try{await Notifications.cancelScheduledNotificationAsync(scheduledId);}catch(e){}
          await AsyncStorage.removeItem('evening_notification_id');
        }
        var now=new Date();
        var lastSent=await AsyncStorage.getItem('evening_notification_last_sent');
        var todayKey=isoDate(now);
        if(now.getHours()>=20){
          if(missing.length>0&&lastSent!==todayKey){
            await Notifications.scheduleNotificationAsync({
              content:{title:'Family check-in',body:'You still have '+missing.length+' pending item(s) today. Tap to finish now.',data:missing[0]},
              trigger:null,
            });
            await AsyncStorage.setItem('evening_notification_last_sent',todayKey);
          }
          return;
        }
        if(missing.length===0)return;
        var triggerDate=new Date(now);triggerDate.setHours(20,0,0,0);
        var id=await Notifications.scheduleNotificationAsync({
          content:{title:'8 PM reminder',body:'You still have pending logs for today. Let\'s close them now.',data:missing[0]},
          trigger:triggerDate,
        });
        await AsyncStorage.setItem('evening_notification_id',id);
      }catch(e){console.log('[EVENING REMINDER ERROR]',e);} 
    })();
  },[user&&user.id,familyId,notificationEnabled,transactions.length,meals.length,wellness.length]);

  useEffect(function(){
    var sub=Notifications.addNotificationResponseReceivedListener(function(resp){
      var data=resp&&resp.notification&&resp.notification.request&&resp.notification.request.content&&resp.notification.request.content.data;
      if(!data)return;
      var action=data.action||null;var tab=data.tab||null;
      if(action)setQuickAction({action:action,mealType:data.mealType||null,nonce:Date.now()});
      if(tab&&navRef&&navRef.isReady())navRef.navigate(tab);
    });
    return function(){if(sub&&sub.remove)sub.remove();};
  },[navRef]);

  // B8: Android hardware back button triggers a light haptic before default action
  useEffect(function(){
    if(Platform.OS!=='android')return;
    var sub=BackHandler.addEventListener('hardwareBackPress',function(){
      haptic('light');
      return false; // Let the default back behaviour continue
    });
    return function(){if(sub&&sub.remove)sub.remove();};
  },[]);

  async function checkAuthState(){
    try{
      console.log('[AUTH STATE] checkAuthState start');
      var sessionRes=await supabase.auth.getSession();
      var session=sessionRes&&sessionRes.data&&sessionRes.data.session;
      console.log('[AUTH STATE] session present:',!!session);

      if(!session){
        console.log('[AUTH STATE] No active session. Sending user to auth/invite_join.');
        setUser(null);
        setCurrentUser(null);
        var code=await checkForInviteCode();
        if(code){
          console.log('[AUTH STATE] Invite code detected. Routing to invite_join:',code);
          setInviteCode(code);
          setCurrentScreen('invite_join');
        }else{
          setCurrentScreen('auth');
        }
        setLoading(false);
        return;
      }

      var sessionUser=session.user;
      setUser(sessionUser);

      var userLookup=await supabase
        .from('users')
        .select('*, families(*)')
        .or('auth_user_id.eq.'+sessionUser.id+',id.eq.'+sessionUser.id)
        .maybeSingle();
      if(userLookup.error)throw userLookup.error;
      var userDoc=userLookup.data;

      if(!userDoc){
        console.log('[AUTH STATE] No public.users row found. Creating for auth user:',sessionUser.id);
        var createRes=await supabase
          .from('users')
          .insert({
            id:sessionUser.id,
            auth_user_id:sessionUser.id,
            user_type:'primary',
            email:sessionUser.email,
            name:normalizeText((sessionUser.email||'').split('@')[0])||'User',
            [DB_COLUMNS.USERS.QUESTIONNAIRE_COMPLETED]:false,
          })
          .select()
          .single();
        if(createRes.error)throw createRes.error;
        userDoc=createRes.data;
        setCurrentUser(userDoc);
        setCurrentScreen('questionnaire');
        console.log('[AUTH STATE] Route -> questionnaire (new user)');
      }else if(!userDoc[DB_COLUMNS.USERS.QUESTIONNAIRE_COMPLETED]){
        setCurrentUser(userDoc);
        setCurrentScreen('questionnaire');
        console.log('[AUTH STATE] Route -> questionnaire (not completed)');
      }else if(!userDoc.family_id){
        setCurrentUser(userDoc);
        if(userDoc.user_type==='member'){
          setCurrentScreen('invite_join');
          console.log('[AUTH STATE] Route -> invite_join (member without family)');
        }else{
          setCurrentScreen('family_setup');
          console.log('[AUTH STATE] Route -> family_setup (primary without family)');
        }
      }else{
        setCurrentUser(userDoc);
        setCurrentScreen('main_app');
        console.log('[AUTH STATE] Route -> main_app');
      }

      if(sessionUser&&sessionUser.id){
        repairCreatorRoles(sessionUser.id).catch(function(err){console.log('[ROLE REPAIR SESSION ERROR]',err);});
      }
      setLoading(false);
    }catch(e){
      console.log('[CHECK AUTH STATE ERROR]',e);
      setCurrentScreen('auth');
      setLoading(false);
    }
  }

  useEffect(function(){
    console.log('[NAV] Current screen changed to:',currentScreen);
  },[currentScreen]);

  // Auth state listener
  useEffect(function(){
    checkAuthState();
    var authListener=supabase.auth.onAuthStateChange(function(event,session){
      console.log('[AUTH LISTENER] event:',event,'hasSession:',!!session);
      if(event==='SIGNED_OUT'){
        setFamilyId(null);setFamilyName('');setCurrentUserName('');setUserCreatedAt(null);setOnboarded(false);
        setMembers([]);setTransactions([]);setMeals([]);setGoals([]);setWellness([]);
        setTransactionComments([]);setSharedGoals([]);setSharedGoalContributions([]);setActivityFeed([]);setCustomCategories([]);setUserProfile(null);setMemberProfiles({});
        setScores([]);setStreaks([]);setIsAdmin(false);setShowSettings(false);setShowQuestionnaire(false);setQuickAction(null);
        setTodayNudge(null);setNudgeHistory([]);setDismissedNudgeIds([]);setRecurringTransactions([]);setNotificationEnabled(true);setWaterTrackingEnabled(false);
        setCurrentUser(null);
      }
      if(event==='SIGNED_IN' && session && session.user && session.user.id){
        repairCreatorRoles(session.user.id).catch(function(err){console.log('[ROLE REPAIR SIGNIN ERROR]',err);});
      }
      checkAuthState();
    });
    return function(){if(authListener&&authListener.data&&authListener.data.subscription)authListener.data.subscription.unsubscribe();};
  },[]);

  async function repairCreatorRoles(targetUserId,targetFamilyId){
    if(!targetUserId)return;
    try{
      var familiesQuery=supabase.from('families').select('id,created_by').eq('created_by',targetUserId);
      if(targetFamilyId)familiesQuery=familiesQuery.eq('id',targetFamilyId);
      var {data:families,error:familiesErr}=await familiesQuery;
      if(familiesErr)throw familiesErr;
      if(!families||families.length===0)return;

      for(var i=0;i<families.length;i++){
        var family=families[i];
        var {data:creatorRow,error:creatorErr}=await supabase
          .from('family_members')
.select('id,role,user_id')
          .eq('family_id',family.id)
          .eq('user_id',targetUserId)
          .maybeSingle();
        if(creatorErr)throw creatorErr;

        if(creatorRow && creatorRow.role!=='admin'){
          var {error:updateErr}=await supabase
            .from('family_members')
.update({role:'admin'})
            .eq('id',creatorRow.id);
          if(updateErr)throw updateErr;
          console.log('[ROLE REPAIR] Updated creator role to admin for family',family.id);
        }
      }
    }catch(error){
      console.log('[ROLE REPAIR ERROR]',error);
    }
  }

  // Load user profile + figure out admin status
  useEffect(function(){
    if(!user){
      setFamilyId(null);setFamilyName('');setCurrentUserName('');setUserCreatedAt(null);setOnboarded(false);
      setMembers([]);setTransactions([]);setMeals([]);setGoals([]);setWellness([]);
      setTransactionComments([]);setSharedGoals([]);setSharedGoalContributions([]);setActivityFeed([]);setCustomCategories([]);setUserProfile(null);setMemberProfiles({});
      setScores([]);setStreaks([]);setIsAdmin(false);setQuickAction(null);
      setNudgeHistory([]);setDismissedNudgeIds([]);setRecurringTransactions([]);setShowQuestionnaire(false);
      return;
    }
    (async function(){
      try{
        var{data:userDoc,error:userErr}=await supabase.from('users').select('*').or('id.eq.'+user.id+',auth_user_id.eq.'+user.id).maybeSingle();
        if(userErr)throw userErr;
        if(userDoc){
          var profileName=normalizeText(userDoc.name||(userDoc.questionnaire_data&&userDoc.questionnaire_data.q1_name)||(userDoc.questionnaire_data&&userDoc.questionnaire_data.q1)||'');
          setCurrentUserName(profileName||getDisplayName(userDoc,user&&user.email));
          setUserCreatedAt(userDoc.created_at||user.created_at||new Date().toISOString());
          setFamilyId(userDoc.family_id||null);
          if(userDoc.family_id){
            var famNameRes=await supabase.from('families').select('family_name').eq('id',userDoc.family_id).maybeSingle();
            setFamilyName((famNameRes&&famNameRes.data&&famNameRes.data.family_name)||'My Family');
          }else{
            setFamilyName('My Family');
          }
          var questionnaireDone=(userDoc[DB_COLUMNS.USERS.QUESTIONNAIRE_COMPLETED]===true);
          setOnboarded(questionnaireDone);
          setNotificationEnabled(userDoc.notification_enabled!==false);
          setWaterTrackingEnabled(userDoc.water_tracking_enabled===true);
          setUserProfile(userDoc);
          if(userDoc.family_id){
            await repairCreatorRoles(user.id,userDoc.family_id);
            var{data:famRow,error:famErr}=await supabase.from('families').select('created_by').eq('id',userDoc.family_id).maybeSingle();
            if(famErr)throw famErr;
            var adminByCreator=!!(famRow && famRow.created_by===user.id);
            var{data:memberRow}=await supabase.from('family_members').select('role').eq('family_id',userDoc.family_id).eq('user_id',user.id).maybeSingle();
            var adminByRole=memberRow&&memberRow.role==='admin';
            setIsAdmin(!!(adminByCreator||adminByRole));
          } else {
            setIsAdmin(false);
          }
        } else {
          setCurrentUserName(getDisplayName(null,user&&user.email));
          setUserCreatedAt(user.created_at||new Date().toISOString());
          setUserProfile(null);
          setOnboarded(false);setFamilyId(null);setIsAdmin(false);
        }
      }catch(e){
        showFriendlyError('Could not load your profile',e);
        setCurrentUserName(getDisplayName(null,user&&user.email));
        setUserCreatedAt(user.created_at||new Date().toISOString());
        setUserProfile(null);
        setOnboarded(false);setFamilyId(null);setIsAdmin(false);
      }
    })();
  },[user]);

  async function loadFamilyMembers(fid){
    var family=fid||familyId;
    if(!family){setMembers([]);return[];}
    var r=await supabase
      .from('family_members')
      .select(`
        *,
        users!family_members_user_id_fkey(id,name,email),
        families(family_name)
      `)
      .eq('family_id',family);
    if(r.error)throw r.error;

    var rows=(r.data||[]).map(function(m,index){
      var userRow=m.users||{};
      var displayName=normalizeText(userRow.name)||('Member '+(index+1));
      return {
        id:m.id,
        name:displayName,
        role:m.role||'parent',
        accessRole:m.role==='admin'?'admin':'member',
        slot:index,
        order:index,
        userId:m.user_id||null,
        inviteCode:null,
        inviteExpiresAt:null,
        joinedAt:m.joined_at||null,
        email:userRow.email||null,
      };
    });

    setMembers(rows);
    return rows;
  }

  async function refreshMembers(fid){
    return loadFamilyMembers(fid);
  }

  async function refreshTransactions(fid){
    if(!(fid||familyId))return[];
    var family=(fid||familyId);
    var r=await supabase.from('transactions').select('*').eq('family_id',family).order('date',{ascending:false});
    if(r.error)throw r.error;
    var rows=normTransactions(r.data||[]);
    setTransactions(rows);
    return rows;
  }
  async function refreshMeals(fid){
    if(!(fid||familyId))return[];
    var family=(fid||familyId);
    var r=await supabase.from('meals').select('*').eq('family_id',family).order('date',{ascending:false});
    if(r.error)throw r.error;
    var rows=normMeals(r.data||[]);
    setMeals(rows);
    return rows;
  }
  async function refreshGoals(fid){
    if(!(fid||familyId))return[];
    var family=(fid||familyId);
    var r=await supabase.from('goals').select('*').eq('family_id',family);
    if(r.error)throw r.error;
    var rows=r.data||[];
    setGoals(rows);
    return rows;
  }
  async function refreshWellness(fid){
    if(!(fid||familyId))return[];
    var family=(fid||familyId);
    var r=await supabase.from('wellness').select('*').eq('family_id',family);
    if(r.error)throw r.error;
    var rows=normWellness(r.data||[]);
    setWellness(rows);
    return rows;
  }

  async function refreshTransactionComments(fid){
    var family=(fid||familyId);
    if(!family)return[];
    var r=await supabase.from('transaction_comments').select('*').eq('family_id',family).order('created_at',{ascending:false}).limit(500);
    if(r.error)throw r.error;
    setTransactionComments(r.data||[]);
    return r.data||[];
  }

  async function refreshSharedGoals(fid){
    var family=(fid||familyId);
    if(!family)return[];
    var r=await supabase.from('shared_goals').select('*').eq('family_id',family).order('created_at',{ascending:false});
    if(r.error)throw r.error;
    setSharedGoals(r.data||[]);
    return r.data||[];
  }

  async function refreshSharedGoalContributions(fid){
    var family=(fid||familyId);
    if(!family)return[];
    var r=await supabase.from('shared_goal_contributions').select('*').eq('family_id',family).order('contributed_at',{ascending:false}).limit(1000);
    if(r.error)throw r.error;
    setSharedGoalContributions(r.data||[]);
    return r.data||[];
  }

  async function refreshActivityFeed(fid){
    var family=(fid||familyId);
    if(!family)return[];
    var r=await supabase.from('activity_feed').select('*').eq('family_id',family).order('created_at',{ascending:false}).limit(200);
    if(r.error)throw r.error;
    setActivityFeed(r.data||[]);
    return r.data||[];
  }

  async function refreshCustomCategories(fid){
    var family=(fid||familyId);
    if(!family)return[];
    var r=await supabase.from('custom_categories').select('*').eq('family_id',family).order('category_name');
    if(r.error)throw r.error;
    setCustomCategories(r.data||[]);
    return r.data||[];
  }

  async function refreshUserProfile(uid){
    var target=uid||(user&&user.id);
    if(!target)return null;
    var r=await supabase.from('users').select('*').eq('id',target).maybeSingle();
    if(r.error)throw r.error;
    setUserProfile(r.data||null);
    return r.data||null;
  }

  async function refreshMemberProfiles(fid){
    var family=fid||familyId;
    if(!family){setMemberProfiles({});return{};}
    var r=await supabase.from('users').select('id,name,weight,weight_unit,questionnaire_data').eq('family_id',family);
    if(r.error)throw r.error;
    var map={};
    (r.data||[]).forEach(function(u){
      var q=u.questionnaire_data||{};
      var weightKg=parseWeightKg(u.weight||q.q19_weight,u.weight_unit||q.q19_weight_unit||'kg');
      map[u.id]={
        userId:u.id,
        name:u.name||q.q1_name||'',
        weightKg:weightKg,
      };
    });
    setMemberProfiles(map);
    return map;
  }

  async function logActivity(activityType,activityData,referenceId,fid){
    var family=(fid||familyId);
    if(!family||!user)return;
    try{
      var res=await supabase.from('activity_feed').insert({
        family_id:family,
        user_id:user.id,
        activity_type:activityType,
        activity_data:activityData||{},
        reference_id:referenceId||null,
      });
      if(res&&res.error){console.log('[ACTIVITY FEED INSERT ERROR]',res.error);} 
      else {refreshActivityFeed(family).catch(function(err){console.log('[ACTIVITY FEED REFRESH ERROR]',err);});}
    }catch(e){console.log('[ACTIVITY FEED INSERT ERROR]',e);}
  }

  function upsertById(list,item){
    var exists=false;
    var next=(list||[]).map(function(row){if(row.id===item.id){exists=true;return item;}return row;});
    if(!exists)next=[item].concat(next);
    return next;
  }
  function upsertTransactionLocal(tx){if(!tx||!tx.id)return;setTransactions(function(prev){return upsertById(prev,tx).sort(function(a,b){return String(b.date).localeCompare(String(a.date));});});}
  function removeTransactionLocal(id){setTransactions(function(prev){return(prev||[]).filter(function(t){return t.id!==id;});});}
  function upsertMealLocal(meal){if(!meal||!meal.id)return;setMeals(function(prev){return upsertById(prev,meal).sort(function(a,b){return String(b.date).localeCompare(String(a.date));});});}
  function removeMealLocal(id){setMeals(function(prev){return(prev||[]).filter(function(m){return m.id!==id;});});}
  function upsertWellnessLocal(row){if(!row)return;setWellness(function(prev){
    var found=false;
    var next=(prev||[]).map(function(w){
      if(w.family_id===row.family_id&&w.memberId===row.memberId&&w.date===row.date){found=true;return row;}
      return w;
    });
    if(!found)next=[row].concat(next);
    return next;
  });}
  function removeWellnessLocal(memberId,date){setWellness(function(prev){return(prev||[]).filter(function(w){return!(w.memberId===memberId&&w.date===date);});});}
  function upsertGoalLocal(goal){if(!goal||!goal.id)return;setGoals(function(prev){return upsertById(prev,goal);});}
  function removeGoalLocal(id){setGoals(function(prev){return(prev||[]).filter(function(g){return g.id!==id;});});}

  // Load all data + realtime + intelligence layer init
  useEffect(function(){
    if(!familyId) return;
    var cancelled=false;

    (async function(){
      try{
        var memberRows=await refreshMembers(familyId);
        // Phase 1 fix: if creator row is not linked to current user (legacy data), link the creator slot now.
        if(user&&isAdmin&&memberRows.length>0&&!memberRows.some(function(m){return m.userId===user.id;})){
          var creatorSlot=memberRows.find(function(m){return normalizeText(m.name).toLowerCase()===normalizeText(currentUserName).toLowerCase();})||memberRows[0];
          var{error:linkErr}=await supabase.from('family_members').update({user_id:user.id,joined_at:new Date().toISOString(),role:'admin'}).eq('id',creatorSlot.id);
          if(linkErr)throw linkErr;
          memberRows=await refreshMembers(familyId);
        }

        await Promise.all([
          refreshTransactions(familyId),
          refreshMeals(familyId),
          refreshGoals(familyId),
          refreshWellness(familyId),
          refreshRecurringTransactions(familyId),
          refreshTransactionComments(familyId),
          refreshSharedGoals(familyId),
          refreshSharedGoalContributions(familyId),
          refreshActivityFeed(familyId),
          refreshCustomCategories(familyId),
          refreshUserProfile(user&&user.id),
          refreshMemberProfiles(familyId),
        ]);

        var scoreRes=await supabase.from('family_scores').select('*').eq('family_id',familyId).order('date',{ascending:false}).limit(500);
        if(scoreRes.error)throw scoreRes.error;
        var streakRes=await supabase.from('streaks').select('*').eq('family_id',familyId);
        if(streakRes.error)throw streakRes.error;

        if(!cancelled){
          setScores(scoreRes.data||[]);
          setStreaks(streakRes.data||[]);
        }
      }catch(e){if(!cancelled)showFriendlyError('Could not sync family data',e);}
    })();

    if(user){
      registerPush(user.id);
      fetchTodayNudge(user.id);
      refreshNudges(user.id).catch(function(e){console.log('[NUDGE HISTORY ERROR]',e);});
    }
    refreshRecurringTransactions(familyId).catch(function(e){console.log('[RECURRING FETCH ERROR]',e);});
    checkAndCreateRecurringTransactions(familyId).catch(function(e){console.log('[RECURRING AUTO CHECK ERROR]',e);});
    var ch=supabase.channel('fam_'+familyId)
      .on('postgres_changes',{event:'*',schema:'public',table:'family_members',filter:'family_id=eq.'+familyId},function(){refreshMembers(familyId).catch(function(e){console.log('[REALTIME MEMBERS ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'transactions',filter:'family_id=eq.'+familyId},function(){refreshTransactions(familyId).catch(function(e){console.log('[REALTIME TX ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'meals',filter:'family_id=eq.'+familyId},function(){refreshMeals(familyId).catch(function(e){console.log('[REALTIME MEALS ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'goals',filter:'family_id=eq.'+familyId},function(){refreshGoals(familyId).catch(function(e){console.log('[REALTIME GOALS ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'wellness',filter:'family_id=eq.'+familyId},function(){refreshWellness(familyId).catch(function(e){console.log('[REALTIME WELLNESS ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'family_scores',filter:'family_id=eq.'+familyId},function(){supabase.from('family_scores').select('*').eq('family_id',familyId).order('date',{ascending:false}).limit(500).then(function(r){if(!r.error)setScores(r.data||[]);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'streaks',filter:'family_id=eq.'+familyId},function(){supabase.from('streaks').select('*').eq('family_id',familyId).then(function(r){if(!r.error)setStreaks(r.data||[]);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'recurring_transactions',filter:'family_id=eq.'+familyId},function(){refreshRecurringTransactions(familyId).catch(function(e){console.log('[REALTIME RECURRING ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'transaction_comments',filter:'family_id=eq.'+familyId},function(){refreshTransactionComments(familyId).catch(function(e){console.log('[REALTIME COMMENTS ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'shared_goals',filter:'family_id=eq.'+familyId},function(){refreshSharedGoals(familyId).catch(function(e){console.log('[REALTIME SHARED GOALS ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'shared_goal_contributions',filter:'family_id=eq.'+familyId},function(){refreshSharedGoalContributions(familyId).catch(function(e){console.log('[REALTIME SHARED CONTRIB ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'activity_feed',filter:'family_id=eq.'+familyId},function(){refreshActivityFeed(familyId).catch(function(e){console.log('[REALTIME ACTIVITY ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'custom_categories',filter:'family_id=eq.'+familyId},function(){refreshCustomCategories(familyId).catch(function(e){console.log('[REALTIME CUSTOM CAT ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'users',filter:'family_id=eq.'+familyId},function(){refreshUserProfile(user&&user.id).catch(function(e){console.log('[REALTIME PROFILE ERROR]',e);});refreshMemberProfiles(familyId).catch(function(e){console.log('[REALTIME MEMBER PROFILE ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'nudges',filter:'user_id=eq.'+(user&&user.id?user.id:'')},function(){if(user){fetchTodayNudge(user.id);refreshNudges(user.id).catch(function(e){console.log('[REALTIME NUDGES ERROR]',e);});}})
      .subscribe();
    return function(){cancelled=true;supabase.removeChannel(ch);};
  },[familyId,user&&user.id,isAdmin,currentUserName]);

  if(loading||currentScreen==='loading')return<GestureHandlerRootView style={{flex:1}}><View style={[z.scr,z.cen]}><ActivityIndicator size="large" color="#1C6B50"/></View></GestureHandlerRootView>;

  if(currentScreen==='auth'){
    return<GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><NavigationContainer ref={navRef}><StatusBar barStyle={'light-content'} backgroundColor={theme.primary}/>
      <AuthScreen
        initialInviteCode={inviteCode}
        onWantJoin={function(code){if(code)setInviteCode(code);setCurrentScreen('invite_join');}}
        onAuthSuccess={handleAuthSuccess}
        onAuthRefreshRequested={handleAuthRefreshRequested}
      />
    </NavigationContainer></SafeAreaProvider></GestureHandlerRootView>;
  }

  if(currentScreen==='invite_join'){
    return<GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><NavigationContainer ref={navRef}><StatusBar barStyle={theme.statusBar} backgroundColor={theme.background}/>
      <InviteJoinScreen initialCode={inviteCode} onBack={function(){setCurrentScreen('auth');}} onJoined={function(){checkAuthState();}}/>
    </NavigationContainer></SafeAreaProvider></GestureHandlerRootView>;
  }

  if(!user){
    return<GestureHandlerRootView style={{flex:1}}><View style={[z.scr,z.cen]}><ActivityIndicator size="large" color="#1C6B50"/></View></GestureHandlerRootView>;
  }

  if(currentScreen==='questionnaire'){
    return (
      <GestureHandlerRootView style={{flex:1}}>
        <SafeAreaProvider>
          <NavigationContainer ref={navRef}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.background}/>
            <QuestionnaireScreen
              userId={user.id}
              onComplete={function(next,updatedUser){
                setOnboarded(true);
                if(updatedUser){
                  setCurrentUser(updatedUser);
                  setCurrentUserName(getDisplayName(updatedUser,user&&user.email));
                }
                if(next==='family_setup')setCurrentScreen('family_setup');
                else setCurrentScreen('main_app');
              }}
            />
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if(currentScreen==='family_setup'){
    return (
      <GestureHandlerRootView style={{flex:1}}>
        <SafeAreaProvider>
          <NavigationContainer ref={navRef}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.background}/>
            <FamilySetupScreen
              userId={user.id}
              currentUserName={currentUserName}
              onDone={function(fid,fn){
                setFamilyId(fid);
                setFamilyName(fn);
                setIsAdmin(true);
                setCurrentScreen('main_app');
              }}
            />
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return(<GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><AppContext.Provider value={{
    familyId:familyId,familyName:familyName,setFamilyName:setFamilyName,members:members,
    transactions:transactions,meals:meals,goals:goals,wellness:wellness,
    scores:scores,streaks:streaks,isAdmin:isAdmin,
    userId:user.id,currentUserName:currentUserName,userCreatedAt:userCreatedAt,
    todayNudge:todayNudge,
    nudgeHistory:nudgeHistory,
    recurringTransactions:recurringTransactions,
    transactionComments:transactionComments,
    sharedGoals:sharedGoals,
    sharedGoalContributions:sharedGoalContributions,
    activityFeed:activityFeed,
    customCategories:customCategories,
    userProfile:userProfile,
    memberProfiles:memberProfiles,
    notificationEnabled:notificationEnabled,
    setNotificationEnabled:setNotificationEnabled,
    waterTrackingEnabled:waterTrackingEnabled,
    setWaterTrackingEnabled:setWaterTrackingEnabled,
    theme:getThemeColors(),
    quickAction:quickAction,
    setQuickAction:setQuickAction,
    openSettings:function(){setShowSettings(true);},
    openQuestionnaire:function(){setShowQuestionnaire(true);},
    refreshNudges:refreshNudges,
    dismissNudge:dismissNudge,
    dismissedNudgeIds:dismissedNudgeIds,
    refreshTodayNudge:fetchTodayNudge,
    refreshRecurringTransactions:refreshRecurringTransactions,
    refreshTransactionComments:refreshTransactionComments,
    refreshSharedGoals:refreshSharedGoals,
    refreshSharedGoalContributions:refreshSharedGoalContributions,
    refreshActivityFeed:refreshActivityFeed,
    refreshCustomCategories:refreshCustomCategories,
    refreshUserProfile:refreshUserProfile,
    logActivity:logActivity,
    refreshMembers:refreshMembers,
    refreshTransactions:refreshTransactions,
    refreshMeals:refreshMeals,
    refreshGoals:refreshGoals,
    refreshWellness:refreshWellness,
    upsertTransactionLocal:upsertTransactionLocal,
    removeTransactionLocal:removeTransactionLocal,
    upsertMealLocal:upsertMealLocal,
    removeMealLocal:removeMealLocal,
    upsertWellnessLocal:upsertWellnessLocal,
    removeWellnessLocal:removeWellnessLocal,
    upsertGoalLocal:upsertGoalLocal,
    removeGoalLocal:removeGoalLocal,
  }}>
    <NavigationContainer ref={navRef}><StatusBar barStyle={theme.statusBar} backgroundColor={theme.background}/><MainTabs/></NavigationContainer>
    {/* B7: Settings overlay — slides up from bottom when gear is tapped in Home header */}
    {showSettings && <Modal visible={true} animationType="slide" onRequestClose={function(){setShowSettings(false);}}><SettingsScreen onClose={function(){setShowSettings(false);}}/></Modal>}
    {showQuestionnaire && <Modal visible={true} animationType="slide" onRequestClose={function(){setShowQuestionnaire(false);}}><QuestionnaireScreen userId={user.id} isModal={true} onSkipped={function(){setShowQuestionnaire(false);}} onComplete={function(){setShowQuestionnaire(false);setOnboarded(true);}}/></Modal>}
  </AppContext.Provider></SafeAreaProvider></GestureHandlerRootView>);
}

// ═══════════════════════════════════════════════════════════════
// ROOT — wraps AppInner with ThemeProvider so theme tokens are available
// to every screen, modal, and the FloatingTabBar.
// ═══════════════════════════════════════════════════════════════
export default function App(){
  return React.createElement(ThemeProvider,null,React.createElement(AppInner,null));
}

export {
  AuthScreen,
  QuestionnaireScreen,
  FamilySetupScreen,
  InviteJoinScreen,
  HomeScreen,
  FinanceScreen,
  WellnessScreen,
  FamilyScreen,
  InsightsScreen,
  SettingsScreen,
  MainTabs,
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Warm Cream design system
// Keys preserved from previous version so existing screens recolor automatically.
// All colour values use the LIGHT theme; screens that pass theme.* overrides
// (e.g. backgroundColor:theme.background) will get correct dark-mode colors.
// ═══════════════════════════════════════════════════════════════
var z=StyleSheet.create({
  scr:{flex:1,backgroundColor:'#FAF8F5'},fScr:{flex:1,backgroundColor:'#FAF8F5'},fl:{flex:1},
  pad:{paddingHorizontal:20,paddingBottom:120},row:{flexDirection:'row',alignItems:'center'},cen:{alignItems:'center',justifyContent:'center'},

  // Auth — split layout handled inline with theme tokens
  authScr:{flex:1,backgroundColor:'#FAF8F5'},
  authTitle:{fontSize:32,fontWeight:'600',color:'#1A1208',marginBottom:8,textAlign:'center',letterSpacing:-0.5},
  authSub:{fontSize:14,fontWeight:'400',color:'#6B5E52',marginBottom:32,textAlign:'center'},
  linkTx:{fontSize:14,fontWeight:'600',color:'#1C6B50'},

  // Questionnaire
  qScr:{flex:1,backgroundColor:'#FAF8F5'},
  qCenter:{flex:1,justifyContent:'center',alignItems:'center',paddingHorizontal:32},
  qPad:{paddingHorizontal:24,paddingTop:40,paddingBottom:60},
  qStickyProgWrap:{position:'absolute',top:0,left:0,right:0,zIndex:999,backgroundColor:'#FAF8F5',paddingHorizontal:24,paddingTop:14,paddingBottom:8,borderBottomWidth:1,borderBottomColor:'#EDE8E2'},
  qOpener:{fontSize:11,fontWeight:'500',color:'#A89D95',textAlign:'center',marginBottom:40,letterSpacing:0.4,textTransform:'uppercase'},
  qText:{fontSize:18,fontWeight:'500',color:'#1A1208',lineHeight:26,marginBottom:24},
  qNote:{fontSize:12,fontWeight:'400',color:'#A89D95',marginBottom:16,lineHeight:18},
  qTransition:{fontSize:20,fontWeight:'400',color:'#1A1208',textAlign:'center',lineHeight:32,fontStyle:'italic'},
  qFinalTitle:{fontSize:28,fontWeight:'600',color:'#1A1208',textAlign:'center',marginBottom:16,letterSpacing:-0.5},
  qFinalBody:{fontSize:18,fontWeight:'400',color:'#6B5E52',textAlign:'center',lineHeight:28,fontStyle:'italic'},
  qInput:{height:48,borderWidth:1,borderColor:'#EDE8E2',borderRadius:12,paddingHorizontal:14,paddingVertical:10,fontSize:16,color:'#1A1208',backgroundColor:'#FFFFFF',marginBottom:8},
  qExample:{fontSize:12,fontWeight:'400',color:'#A89D95',marginTop:4,lineHeight:18,fontStyle:'italic'},
  qKeepGoing:{fontSize:12,fontWeight:'500',color:'#C4773B',marginTop:4},
  qTransitionCard:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#EDE8E2',borderRadius:16,padding:20,marginBottom:16},
  qTransitionLine:{fontSize:20,fontWeight:'400',color:'#1A1208',textAlign:'center',lineHeight:30,fontFamily:Platform.OS==='ios'?'Georgia':'serif'},
  qQuestionText:{fontSize:15,fontWeight:'600',color:'#1A1208',lineHeight:22,marginBottom:8,marginTop:4},
  qProgDot:{flex:1,height:4,borderRadius:2,backgroundColor:'#EDE8E2'},
  qProgDotOn:{backgroundColor:'#1C6B50'},
  qSliderValue:{fontSize:32,fontWeight:'600',color:'#1A1208',marginBottom:8,textAlign:'center',letterSpacing:-0.5},
  qSliderChip:{minWidth:40,height:40,borderRadius:20,borderWidth:1,borderColor:'#EDE8E2',alignItems:'center',justifyContent:'center',paddingHorizontal:8,backgroundColor:'#FFFFFF'},
  qSliderChipSel:{backgroundColor:'#1C6B50',borderColor:'#1C6B50'},
  qSliderChipTx:{fontSize:13,color:'#6B5E52',fontWeight:'500'},
  qSliderChipTxSel:{color:'#FFFFFF',fontWeight:'600'},
  qOption:{borderWidth:1,borderColor:'#EDE8E2',borderRadius:14,paddingVertical:14,paddingHorizontal:16,marginBottom:10,backgroundColor:'#FFFFFF'},
  qOptionSel:{backgroundColor:'#E4F2EC',borderColor:'#1C6B50'},
  qOptionTx:{fontSize:15,fontWeight:'500',color:'#1A1208'},
  qOptionSelTx:{color:'#1C6B50',fontWeight:'600'},
  qBtn:{backgroundColor:'#1C6B50',borderRadius:14,paddingVertical:14,alignItems:'center',marginTop:24},
  qBtnDisabled:{backgroundColor:'#EDE8E2'},
  qSliderVal:{fontSize:36,fontWeight:'600',color:'#1A1208',textAlign:'center',marginBottom:16,letterSpacing:-0.5},
  qSliderRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:12},
  qSliderDot:{width:32,height:32,borderRadius:16,backgroundColor:'#F3EFE9',alignItems:'center',justifyContent:'center'},
  qSliderDotSel:{backgroundColor:'#1C6B50'},
  qSliderDotTx:{fontSize:12,fontWeight:'600',color:'#6B5E52'},
  qSliderDotSelTx:{color:'#FFFFFF'},

  // Typography
  h1:{fontSize:28,fontWeight:'700',color:'#1A1208',marginBottom:4,letterSpacing:-0.5},
  sec:{fontSize:13,fontWeight:'600',color:'#6B5E52',marginTop:24,marginBottom:12,letterSpacing:0.3,textTransform:'uppercase'},
  caps:{fontSize:11,fontWeight:'600',color:'#A89D95',letterSpacing:0.8,textTransform:'uppercase'},
  sub:{fontSize:13,fontWeight:'400',color:'#6B5E52'},
  cap:{fontSize:11,fontWeight:'400',color:'#A89D95'},
  body:{fontSize:14,fontWeight:'400',color:'#1A1208'},
  heroN:{fontSize:36,fontWeight:'700',letterSpacing:-1,marginBottom:4,color:'#1A1208'},
  fv:{fontSize:14,fontWeight:'600',color:'#1A1208'},
  txM:{fontSize:14,fontWeight:'600',color:'#1A1208'},

  // Cards & inputs
  card:{backgroundColor:'#FFFFFF',borderRadius:16,borderWidth:1,borderColor:'#EDE8E2',padding:16,marginBottom:10},
  inp:{height:48,borderWidth:1,borderColor:'#EDE8E2',borderRadius:12,paddingHorizontal:14,paddingVertical:10,fontSize:16,color:'#1A1208',backgroundColor:'#FFFFFF'},
  dateBtn:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  dateBtnTx:{fontSize:16,color:'#1A1208'},
  placeholderTx:{color:'#A89D95'},
  pickRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:12,paddingHorizontal:14,borderRadius:12,borderWidth:1,borderColor:'#EDE8E2',marginBottom:8,backgroundColor:'#FFFFFF'},
  pickRowSel:{backgroundColor:'#E4F2EC',borderColor:'#1C6B50'},
  inpLabel:{fontSize:12,fontWeight:'600',color:'#6B5E52',marginBottom:6,letterSpacing:0.2},

  // Chips
  chip:{borderRadius:100,borderWidth:1,borderColor:'#EDE8E2',paddingVertical:8,paddingHorizontal:14,backgroundColor:'#FFFFFF'},
  chipTx:{fontSize:12,fontWeight:'500',color:'#6B5E52'},
  chipSel:{backgroundColor:'#E4F2EC',borderColor:'#1C6B50'},
  chipSelTx:{color:'#1C6B50',fontWeight:'600'},

  // Plan / setup cards
  planCard:{backgroundColor:'#FFFFFF',borderRadius:16,borderWidth:1,borderColor:'#EDE8E2',padding:16,marginBottom:12},
  planSel:{borderColor:'#1C6B50',backgroundColor:'#E4F2EC'},
  planTitle:{fontSize:20,fontWeight:'600',color:'#1A1208',marginBottom:4,letterSpacing:-0.3},
  planSub:{fontSize:14,fontWeight:'400',color:'#6B5E52',marginBottom:2},
  rmTx:{fontSize:12,fontWeight:'600',color:'#C94040',marginTop:8},

  // Header
  hdr:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingTop:8,paddingBottom:16},
  avS:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#FAF8F5'},
  avSTx:{fontSize:11,fontWeight:'600'},
  famNm:{fontSize:18,fontWeight:'700',color:'#1A1208',letterSpacing:-0.3},
  hdrIco:{fontSize:14,fontWeight:'600',color:'#6B5E52'},

  // Dividers
  vDiv:{width:1,backgroundColor:'rgba(255,255,255,0.18)',alignSelf:'stretch',marginHorizontal:14},
  hDiv:{height:1,backgroundColor:'#EDE8E2',marginVertical:10},

  // Stats strip
  strip:{flexDirection:'row',gap:8,marginBottom:4,marginTop:10},
  tile:{flex:1,backgroundColor:'#F3EFE9',borderRadius:12,paddingVertical:12,paddingHorizontal:10},
  tileLbl:{fontSize:11,fontWeight:'500',color:'#6B5E52',marginBottom:4},
  tileVal:{fontSize:14,fontWeight:'600',color:'#1A1208'},

  // Buttons
  bPri:{backgroundColor:'#1C6B50',borderRadius:12,paddingVertical:14,paddingHorizontal:18,alignItems:'center'},
  bPriT:{fontSize:14,fontWeight:'600',color:'#FFFFFF',letterSpacing:0.2},
  bSec:{borderRadius:12,borderWidth:1,borderColor:'#1C6B50',paddingVertical:13,paddingHorizontal:18,alignItems:'center',backgroundColor:'transparent'},
  bSecT:{fontSize:14,fontWeight:'600',color:'#1C6B50'},

  // Pills
  pill:{borderRadius:100,paddingVertical:4,paddingHorizontal:10},
  pillTx:{fontSize:11,fontWeight:'600'},

  // Status cards
  ok:{backgroundColor:'#E4F2EC',borderRadius:12,paddingVertical:14,alignItems:'center'},
  okTx:{fontSize:14,fontWeight:'600',color:'#1C6B50'},

  // Nudge / accent cards
  nudge:{borderLeftWidth:3,borderLeftColor:'#C4773B',backgroundColor:'#FDF0E4',borderRadius:12,padding:14,marginTop:12},
  nudgeTx:{fontSize:14,fontWeight:'500',color:'#1A1208',lineHeight:20},
  insight:{borderLeftWidth:3,borderLeftColor:'#1C6B50',backgroundColor:'#E4F2EC',borderRadius:12,padding:14,marginTop:16},
  insightTx:{fontSize:14,fontWeight:'500',color:'#1C6B50',lineHeight:20},

  // Bars / charts
  barRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',height:96,marginBottom:12},
  barC:{flex:1,alignItems:'center',justifyContent:'flex-end'},
  bar:{width:18,backgroundColor:'#1C6B50',borderRadius:6,marginBottom:6},
  barL:{fontSize:11,fontWeight:'500',color:'#A89D95'},
  note:{fontSize:12,fontWeight:'500',color:'#6B5E52',lineHeight:18},

  // Activity / list rows
  actR:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#EDE8E2'},
  actTx:{fontSize:14,fontWeight:'400',color:'#1A1208',flex:1},

  // Percent badge
  pctB:{borderRadius:100,paddingVertical:3,paddingHorizontal:9},
  pctT:{fontSize:11,fontWeight:'600'},

  // Tx row
  txRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#EDE8E2'},

  // Progress
  pTrk:{backgroundColor:'#F3EFE9',borderRadius:6,overflow:'hidden'},
  pFl:{height:'100%',borderRadius:6},

  // Macros
  macro:{fontSize:11,fontWeight:'500',color:'#6B5E52',backgroundColor:'#F3EFE9',borderRadius:8,paddingVertical:4,paddingHorizontal:10,marginRight:6},

  // Family score
  fScLbl:{fontSize:12,fontWeight:'500',color:'#C4773B',marginBottom:4,letterSpacing:0.3,textTransform:'uppercase'},
  fScNum:{fontSize:40,fontWeight:'700',color:'#1A1208',letterSpacing:-1},
  fScSub:{fontSize:12,fontWeight:'500',color:'#1C6B50',marginTop:4},

  // Family member cards
  chCard:{width:150,borderRadius:18,padding:16,alignItems:'center'},
  chAv:{width:48,height:48,borderRadius:24,backgroundColor:'rgba(255,255,255,0.25)',alignItems:'center',justifyContent:'center',marginBottom:8},
  chAvT:{fontSize:18,fontWeight:'700'},
  chNm:{fontSize:14,fontWeight:'600',color:'#FFFFFF',letterSpacing:0.3},
  chRole:{fontSize:11,fontWeight:'500',color:'rgba(255,255,255,0.75)',marginBottom:8},
  chPts:{fontSize:22,fontWeight:'700',color:'#FFFFFF'},
  chStrk:{fontSize:11,fontWeight:'500',color:'rgba(255,255,255,0.75)',marginBottom:4},
  chPTrk:{height:5,backgroundColor:'rgba(255,255,255,0.2)',borderRadius:3,overflow:'hidden'},
  chPFl:{height:'100%',backgroundColor:'#FFFFFF',borderRadius:3},
  chDly:{fontSize:10,fontWeight:'500',color:'rgba(255,255,255,0.75)',textAlign:'right',marginTop:2},
  chInvite:{marginTop:10,backgroundColor:'rgba(255,255,255,0.25)',borderRadius:8,paddingVertical:7,paddingHorizontal:10,alignSelf:'stretch',alignItems:'center'},
  chInviteTx:{fontSize:11,fontWeight:'600',color:'#FFFFFF',letterSpacing:0.3},

  // Modals
  modalWrap:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.4)'},
  modal:{backgroundColor:'#FFFFFF',borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,maxHeight:'85%'},

  // Tab bar (legacy - replaced by FloatingTabBar)
  tBar:{height:64,backgroundColor:'#FFFFFF',borderTopWidth:1,borderTopColor:'#EDE8E2',paddingBottom:8,paddingTop:6,elevation:0,shadowOpacity:0},

  // Edit/action buttons
  editBtn:{width:32,height:32,alignItems:'center',justifyContent:'center',marginRight:6},
  editTx:{fontSize:16,color:'#A89D95'},

  // Stepper
  stepBtn:{width:48,height:48,borderRadius:12,borderWidth:1,borderColor:'#EDE8E2',backgroundColor:'#F3EFE9',alignItems:'center',justifyContent:'center'},
  stepTx:{fontSize:22,fontWeight:'600',color:'#1C6B50'},

  // Checkbox
  checkbox:{width:18,height:18,borderRadius:5,borderWidth:1.5,borderColor:'#C4773B',marginRight:10,backgroundColor:'#FFFFFF'},

  // Errors
  inpErr:{borderColor:'#C94040',borderWidth:1.5},
  errTx:{fontSize:11,color:'#C94040',marginTop:2,marginBottom:4,fontWeight:'500'},

  // Filters
  filterChip:{backgroundColor:'#FDF0E4',borderRadius:100,paddingVertical:5,paddingHorizontal:10},
  filterChipTx:{fontSize:11,color:'#C4773B',fontWeight:'600'},

  // Calendar
  calCell:{width:'14.285%',aspectRatio:1,borderRadius:10,marginBottom:6,alignItems:'center',justifyContent:'center',borderWidth:1},
  calCellTx:{fontSize:13,color:'#1A1208',fontWeight:'500'},
  calDot:{width:5,height:5,borderRadius:3,marginTop:4},

  // Comments
  commentBubble:{padding:12,borderRadius:14,marginBottom:8,borderWidth:1,borderColor:'#EDE8E2'},
  commentMine:{backgroundColor:'#E4F2EC',alignSelf:'flex-end',maxWidth:'90%'},
  commentOther:{backgroundColor:'#F3EFE9',alignSelf:'flex-start',maxWidth:'90%'},
  commentCountBadge:{position:'absolute',right:-2,top:-3,backgroundColor:'#1C6B50',borderRadius:9,paddingHorizontal:5,minWidth:18,alignItems:'center'},
  commentCountTx:{fontSize:10,color:'#FFFFFF',fontWeight:'700'},

  // Profile
  profileAvatar:{width:72,height:72,borderRadius:36,backgroundColor:'#E4F2EC',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#EDE8E2'},
  profileAvatarImg:{width:72,height:72,borderRadius:36},
  photoPreview:{width:96,height:96,borderRadius:12,marginBottom:10,borderWidth:1,borderColor:'#EDE8E2'},
  profileAvatarTx:{fontSize:26,fontWeight:'700',color:'#1C6B50'},

  // Goal family badge
  goalFamilyBadge:{backgroundColor:'#E4F2EC',borderRadius:8,paddingVertical:3,paddingHorizontal:8,marginLeft:8},
  goalFamilyBadgeTx:{fontSize:10,fontWeight:'600',color:'#1C6B50',letterSpacing:0.3},

  // Admin badge — shown on the Family member chip
  adminBadge:{backgroundColor:'rgba(255,255,255,0.22)',borderRadius:8,paddingVertical:2,paddingHorizontal:6,marginLeft:6},
  adminBadgeTx:{fontSize:10,fontWeight:'700',color:'#FFFFFF',letterSpacing:0.3},
});

