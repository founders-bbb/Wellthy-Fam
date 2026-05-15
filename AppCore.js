import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity, Pressable,
  TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
  Animated, Dimensions, BackHandler, Share, Clipboard, Image, Switch, Linking,
  Appearance, RefreshControl, AppState,
} from 'react-native';
import { NavigationContainer, useNavigation, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
// B8: Haptics and gesture handler
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView, PanGestureHandler, State as GHState } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PieChart, BarChart, LineChart } from 'react-native-chart-kit';
import Svg, { Path, Circle } from 'react-native-svg';
import { supabase, EDGE_MEAL, EDGE_NUDGE, EDGE_UPDATE_PORTION, EDGE_PARSE_STATEMENT, EDGE_FINALIZE_STATEMENT, SUPABASE_ANON_KEY } from './utils/supabaseClient';
import * as DocumentPicker from 'expo-document-picker';
import { DB_COLUMNS } from './utils/constants';

// ─────────────────────────────────────────────────────────────────
// FONT FAMILIES — v5 Saturated Forest typography
// DM Sans (UI), Instrument Serif (editorial), JetBrains Mono (numerics).
// Loaded by App.js via useFonts(); these strings reference the keys we
// registered in @expo-google-fonts/{dm-sans, instrument-serif, jetbrains-mono}.
// DM Serif Display still loaded as defensive backup until Phase 2 sweep.
// ─────────────────────────────────────────────────────────────────
var FF = {
  // ─── DM Sans (UI workhorse) ──────────────────────────────
  sans:        'DMSans-Regular',
  sansLight:   'DMSans-Light',
  sansMed:     'DMSans-Medium',
  sansSemi:    'DMSans-SemiBold',
  sansBold:    'DMSans-Bold',
  sansItalic:  'DMSans-Italic',
  // ─── Instrument Serif (v5 editorial) ─────────────────────
  // serif/serifItalic now resolve to Instrument Serif; any callsite using
  // FF.serif gets the v5 face immediately. serifDM kept as escape hatch.
  serif:       'InstrumentSerif-Regular',
  serifItalic: 'InstrumentSerif-Italic',
  serifDM:     'DMSerif-Regular',         // legacy escape hatch
  serifDMItalic:'DMSerif-Italic',         // legacy escape hatch
  // ─── JetBrains Mono (v5 ledger numerics) ─────────────────
  mono:        'JetBrainsMono-Regular',
  monoMed:     'JetBrainsMono-Medium',
  monoSemi:    'JetBrainsMono-SemiBold',
  monoBold:    'JetBrainsMono-Bold',
};
// Use weight + family pair so DM Sans renders correctly across iOS/Android
function fontW(weight){
  if(weight==='300'||weight===300) return FF.sansLight;
  if(weight==='500'||weight===500) return FF.sansMed;
  if(weight==='600'||weight===600) return FF.sansSemi;
  if(weight==='700'||weight===700||weight==='800'||weight===800||weight==='900'||weight===900) return FF.sansBold;
  return FF.sans; // default 400
}

// Notification handler — shows alert when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
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
  // Per Design Guide — Category Colour Coding (section 05)
  'Daily Essentials':{bg:'#E4F2EC',text:'#085041'},
  'House Bills':     {bg:'#E4EDFB',text:'#1A4A8A'},
  Travel:            {bg:'#FDF0E4',text:'#7A4A10'},
  Health:            {bg:'#FBE4EE',text:'#7A1A3A'},
  Lifestyle:         {bg:'#EDECFB',text:'#3A2A8A'},
  Savings:           {bg:'#E4F2EC',text:'#085041'},
  Income:            {bg:'#E4F2EC',text:'#085041'},
  Cash:              {bg:'#F0EBDC',text:'#5A4A2A'},
  Transfer:          {bg:'#DCE6EC',text:'#2A4A5A'},
  Uncat:             {bg:'#F2F2EE',text:'#555555'},
};
var CAT_LIST = ['Daily Essentials','House Bills','Travel','Health','Lifestyle','Savings','Cash','Transfer'];
var CAT_COLORS = {'Daily Essentials':'#085041','House Bills':'#1A4A8A',Travel:'#7A4A10',Health:'#7A1A3A',Lifestyle:'#3A2A8A',Savings:'#085041',Cash:'#5A4A2A',Transfer:'#2A4A5A'};
// Spending = real outflow. Income/Cash/Transfer are excluded from "spend" totals
// (cash is extracted not consumed; transfers are personal payments, not retail).
function isSpendingCategory(c){return c!=='Income'&&c!=='Cash'&&c!=='Transfer';}
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
// THEME TOKENS — Saturated Forest (v5)
// Source of truth: _design/handoff-v5/fr/tokens.jsx → PALETTES.saturatedForest.
//
// v5 palette migration — Saturated Forest tokens live alongside legacy
// aliases (background, card, primaryOn, primaryLight, accentLight, border,
// warning, success, etc.). Aliases removed in a sweep commit at the END
// of Phase 2 once every screen consumes v5 tokens. Until then, both
// naming schemes are intentional, not a bug.
//
// Visual nuance: primaryLight/accentLight stay as translucent rgba in
// light mode (the old behavior — semi-transparent tint over the bg),
// while the new v5 primarySoft/accentSoft are SOLID pale earth tones.
// Both are wired correctly; migrating a callsite from primaryLight to
// primarySoft shifts the feel from "translucent overlay" to "solid pale".
// In dark mode both names resolve to the same translucent rgba (v5's
// dark spec is translucent for soft tones too).
// ─────────────────────────────────────────────────────────────────
var LIGHT_THEME={
  mode:'light',
  // ─── v5 Saturated Forest (canonical) ────────────────────────────
  bg:'#FAF1DC',
  surface:'#FFFAE3',
  surfaceElevated:'#EFE2C2',
  surfaceSunk:'#E5D6B0',
  primary:'#2F4A2D',
  primaryDeep:'#1B2F19',
  primarySoft:'#D6DEC8',
  accent:'#D26A4A',
  accentDeep:'#A14729',
  accentSoft:'#F4D5C1',
  text:'#1A1408',
  textSecondary:'#564A34',
  muted:'#9A8D72',
  hairline:'#DACDA8',
  hairlineSoft:'#E5D8B3',
  danger:'#A8332C',
  dangerSoft:'#F1D9D6',
  onPrimary:'#FAF3DC',
  onAccent:'#FAF3DC',
  // ─── Legacy aliases (kept until Phase 2 sweep) ──────────────────
  background:'#FAF1DC',                 // alias of bg
  card:'#FFFAE3',                        // alias of surface
  border:'#DACDA8',                      // alias of hairline
  primaryLight:'rgba(47,74,45,0.12)',    // translucent — distinct from v5 primarySoft (solid)
  accentLight:'rgba(210,106,74,0.12)',   // translucent — distinct from v5 accentSoft (solid)
  primaryOn:'#FAF3DC',                   // alias of onPrimary
  warning:'#D26A4A',                     // legacy: warning === accent
  success:'#2F4A2D',                     // legacy: success === primary
  overlay:'rgba(0,0,0,0.4)',
  navBarBg:'#FAF1DC',                    // alias of bg in light
  navBarShadow:'rgba(47,74,45,0.18)',
  statusBar:'dark-content',
};
var DARK_THEME={
  mode:'dark',
  // ─── v5 Saturated Forest (canonical) ────────────────────────────
  bg:'#11140C',
  surface:'#181C12',
  surfaceElevated:'#212618',
  surfaceSunk:'#0B0E07',
  primary:'#9DBE94',
  primaryDeep:'#B6D2AD',
  primarySoft:'rgba(157,190,148,0.15)',
  accent:'#E08861',
  accentDeep:'#EFA482',
  accentSoft:'rgba(224,136,97,0.15)',
  text:'#ECE3CB',
  textSecondary:'#A39880',
  muted:'#6A6248',
  hairline:'#2A2D1B',
  hairlineSoft:'#212413',
  danger:'#DC7770',
  dangerSoft:'rgba(220,119,112,0.14)',
  onPrimary:'#11140C',
  onAccent:'#11140C',
  // ─── Legacy aliases (kept until Phase 2 sweep) ──────────────────
  background:'#11140C',                 // alias of bg
  card:'#181C12',                        // alias of surface
  border:'#2A2D1B',                      // alias of hairline
  primaryLight:'rgba(157,190,148,0.15)', // === primarySoft in dark (both translucent)
  accentLight:'rgba(224,136,97,0.15)',   // === accentSoft in dark
  primaryOn:'#11140C',                   // alias of onPrimary
  warning:'#E08861',                     // legacy: warning === accent
  success:'#9DBE94',                     // legacy: success === primary
  overlay:'rgba(0,0,0,0.6)',
  navBarBg:'#181C12',                    // alias of surface (slight elevation in dark)
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
  meal:{descMax:200,allowedTypes:['breakfast','lunch','snack','dinner']},
  wellness:{waterMin:1,waterMax:20,screenMaxHours:24,waterTargetMinL:0.5,waterTargetMaxL:6,screenTargetMinH:1,screenTargetMaxH:12},
  goals:{nameMax:50},
};

// ─────────────────────────────────────────────────────────────────
// PHASE 6: SCORING SYSTEM
// Member scores, family = sum. Both daily and weekly views.
// Daily caps documented per rule; NOT currently enforced (recordScore fires unconditionally).
// If abuse surfaces, wrap recordScore() in a recordScoreCapped() helper that checks the per-day total.
// ─────────────────────────────────────────────────────────────────
var SCORE_RULES={
  manual_tx:           {points:5,  dailyCap:25, label:'Logged a transaction'},
  all_tx_confirmed:    {points:20, dailyCap:20, label:'Confirmed all pending'},
  goal_contribution:   {points:10, dailyCap:20, label:'Contributed to a goal'},
  meal_logged:         {points:10, dailyCap:30, label:'Logged a meal'},
  protein_target_hit:  {points:25, dailyCap:25, label:'Hit your protein target'},
  water_target_hit:    {points:15, dailyCap:15, label:'Hit your water target'},
  screen_under_limit:  {points:15, dailyCap:15, label:'Screen time under limit'},
  activity_logged:     {points:10, dailyCap:30, label:'Logged an activity'},
  streak_3:            {points:10, dailyCap:50, label:'3-day streak'},
  streak_7:            {points:25, dailyCap:75, label:'7-day streak'},
  streak_30:           {points:100,dailyCap:200,label:'30-day streak'},
  goal_half:           {points:50, dailyCap:100,label:'Goal at 50%'},
  goal_complete:       {points:150,dailyCap:300,label:'Goal complete!'},
};

// ─────────────────────────────────────────────────────────────────
// PHASE 6: PROTEIN GUIDE — Indian foods, fallback inline list
// Used when the foods table is empty or unreachable. Real source = `foods` table.
// ─────────────────────────────────────────────────────────────────
var PROTEIN_GUIDE_FALLBACK=[
  {name:'Paneer',          category:'Dairy & Eggs',  protein:18},
  {name:'Greek Yogurt',    category:'Dairy & Eggs',  protein:10},
  {name:'Curd / Dahi',     category:'Dairy & Eggs',  protein:11},
  {name:'Egg (boiled)',    category:'Dairy & Eggs',  protein:13},
  {name:'Egg whites',      category:'Dairy & Eggs',  protein:11},
  {name:'Cottage cheese',  category:'Dairy & Eggs',  protein:18},
  {name:'Milk (full fat)', category:'Dairy & Eggs',  protein:3},
  {name:'Toor Dal (cooked)',     category:'Pulses & Lentils', protein:8},
  {name:'Moong Dal (cooked)',    category:'Pulses & Lentils', protein:7},
  {name:'Masoor Dal (cooked)',   category:'Pulses & Lentils', protein:9},
  {name:'Urad Dal (cooked)',     category:'Pulses & Lentils', protein:8},
  {name:'Chana Dal (cooked)',    category:'Pulses & Lentils', protein:8},
  {name:'Sambar',                category:'Pulses & Lentils', protein:6},
  {name:'Chickpeas / Chana',     category:'Legumes',  protein:19},
  {name:'Rajma (cooked)',        category:'Legumes',  protein:9},
  {name:'Black-eyed peas',       category:'Legumes',  protein:8},
  {name:'Soya chunks (dry)',     category:'Legumes',  protein:52},
  {name:'Soya chunks (cooked)',  category:'Legumes',  protein:14},
  {name:'Tofu',                  category:'Legumes',  protein:8},
  {name:'Hummus',                category:'Legumes',  protein:8},
  {name:'Chicken breast',        category:'Meat & Fish', protein:31},
  {name:'Chicken curry',         category:'Meat & Fish', protein:18},
  {name:'Chicken tikka',         category:'Meat & Fish', protein:25},
  {name:'Mutton',                category:'Meat & Fish', protein:26},
  {name:'Fish (rohu)',           category:'Meat & Fish', protein:17},
  {name:'Tuna',                  category:'Meat & Fish', protein:23},
  {name:'Prawns',                category:'Meat & Fish', protein:24},
  {name:'Almonds',               category:'Nuts & Seeds', protein:21},
  {name:'Peanuts',               category:'Nuts & Seeds', protein:25},
  {name:'Cashews',               category:'Nuts & Seeds', protein:18},
  {name:'Walnuts',               category:'Nuts & Seeds', protein:15},
  {name:'Pumpkin seeds',         category:'Nuts & Seeds', protein:30},
  {name:'Chia seeds',            category:'Nuts & Seeds', protein:17},
  {name:'Flax seeds',            category:'Nuts & Seeds', protein:18},
  {name:'Roti (whole wheat)',    category:'Grains',    protein:8},
  {name:'Brown rice (cooked)',   category:'Grains',    protein:3},
  {name:'White rice (cooked)',   category:'Grains',    protein:2},
  {name:'Oats (dry)',            category:'Grains',    protein:13},
  {name:'Quinoa (cooked)',       category:'Grains',    protein:4},
  {name:'Poha',                  category:'Grains',    protein:7},
  {name:'Upma',                  category:'Grains',    protein:6},
  {name:'Dosa (plain)',          category:'Grains',    protein:5},
  {name:'Idli',                  category:'Grains',    protein:4},
  {name:'Besan (gram flour)',    category:'Snacks & Misc', protein:22},
  {name:'Chana (roasted)',       category:'Snacks & Misc', protein:19},
  {name:'Sprouts (mixed)',       category:'Snacks & Misc', protein:9},
  {name:'Peanut butter',         category:'Snacks & Misc', protein:25},
  {name:'Protein bar',           category:'Snacks & Misc', protein:20},
  {name:'Whey protein (1 scoop)',category:'Snacks & Misc', protein:80},
];

// ─────────────────────────────────────────────────────────────────
// PHASE 6: CALENDAR ICON (replaces "July 17" emoji glyph)
// Pure View-based implementation — no SVG/extra imports needed.
// ─────────────────────────────────────────────────────────────────
function CalendarIcon(props){
  var size=props.size||20;
  var color=props.color||'#1A1208';
  return (
    <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
      <View style={{position:'absolute',top:size*0.18,left:0,right:0,height:size*0.78,borderWidth:1.6,borderColor:color,borderRadius:Math.max(2,size*0.12),backgroundColor:'transparent'}}/>
      <View style={{position:'absolute',top:size*0.30,left:size*0.10,right:size*0.10,height:size*0.10,backgroundColor:color,borderRadius:1}}/>
      <View style={{position:'absolute',top:0,left:size*0.22,width:size*0.14,height:size*0.30,borderWidth:1.4,borderColor:color,borderRadius:Math.max(1,size*0.04)}}/>
      <View style={{position:'absolute',top:0,right:size*0.22,width:size*0.14,height:size*0.30,borderWidth:1.4,borderColor:color,borderRadius:Math.max(1,size*0.04)}}/>
      <View style={{position:'absolute',top:size*0.55,left:size*0.20,width:size*0.10,height:size*0.10,borderRadius:size*0.05,backgroundColor:color,opacity:0.7}}/>
      <View style={{position:'absolute',top:size*0.55,left:size*0.45,width:size*0.10,height:size*0.10,borderRadius:size*0.05,backgroundColor:color,opacity:0.7}}/>
      <View style={{position:'absolute',top:size*0.55,right:size*0.20,width:size*0.10,height:size*0.10,borderRadius:size*0.05,backgroundColor:color,opacity:0.7}}/>
      <View style={{position:'absolute',top:size*0.75,left:size*0.20,width:size*0.10,height:size*0.10,borderRadius:size*0.05,backgroundColor:color,opacity:0.5}}/>
      <View style={{position:'absolute',top:size*0.75,left:size*0.45,width:size*0.10,height:size*0.10,borderRadius:size*0.05,backgroundColor:color,opacity:0.5}}/>
    </View>
  );
}

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

// ─── INVITE-JOIN DIAGNOSTIC LOGGER (build #5) ────────────────────────────
// Captures invite-join flow diagnostics to AsyncStorage so the user can share
// them via the "Send debug logs" Share intent without needing adb. Safe by
// design: never logs passwords, JWT contents, or token bytes — only UIDs,
// emails (already in app context), booleans, and Supabase error messages.
// Capped at 200 entries to prevent unbounded storage growth.
async function diagLog(msg){
  try{
    var entry='['+new Date().toISOString()+'] [INVITE JOIN DIAG] '+msg;
    console.log(entry);
    var existing=await AsyncStorage.getItem('inviteJoinDiagLogs');
    var arr=existing?JSON.parse(existing):[];
    arr.push(entry);
    if(arr.length>200)arr=arr.slice(-200);
    await AsyncStorage.setItem('inviteJoinDiagLogs',JSON.stringify(arr));
  }catch(e){
    console.log('[INVITE JOIN DIAG] (storage failed)',e&&e.message);
  }
}

// Shared by the "Send debug logs" buttons on AuthScreen, InviteJoinScreen, and SettingsScreen.
// Uses the React Native Share intent; the user picks WhatsApp / email / copy from the system sheet.
async function shareDiagLogs(){
  try{
    var raw=await AsyncStorage.getItem('inviteJoinDiagLogs');
    var arr=raw?JSON.parse(raw):[];
    var blob='Wellthy Fam — Invite-Join Diagnostic Logs\n'
      +'Captured: '+new Date().toISOString()+'\n'
      +'Entries: '+arr.length+'\n\n'
      +(arr.join('\n')||'(no diagnostic logs captured yet)');
    await Share.share({message:blob,title:'Wellthy Fam debug logs'});
  }catch(e){
    console.log('[DIAG SHARE ERROR]',e);
    Alert.alert('Could not share logs',(e&&e.message)||'Unknown error');
  }
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

// Promises feature: resolve a family_members row to a display name.
// Names live on users.name (family_members.name is often null), so
// walk: family_members.name -> memberProfiles[user_id].name (from
// users.name) -> currentUserName for self -> 'Member'.
function resolveMemberName(member,memberProfiles,userId,currentUserName){
  if(!member)return'Member';
  if(member.name)return member.name;
  if(member.userId&&memberProfiles&&memberProfiles[member.userId]
     &&memberProfiles[member.userId].name){
    return memberProfiles[member.userId].name;
  }
  if(member.userId===userId&&currentUserName)return currentUserName;
  return'Member';
}

// Promises feature: stick-filter checks for transactional/punitive
// language in commitment text. Returns an error message string if
// the text matches a forbidden pattern, null otherwise.
function checkPromiseStickFilter(text){
  if(!text)return null;
  var t=text.toLowerCase();
  // Conditional / transactional
  if(/\bif you\b.*\b(i'?ll|i will)\b/.test(t)){
    return "Try writing it as \"I'll ____ and you'll ____\" - promises read sideways, not as deals.";
  }
  // Threat
  if(/\bor else\b|\botherwise i'?ll\b|\botherwise i will\b|\bunless you\b/.test(t)){
    return "Promises here only describe what you'll do - not what happens if it doesn't.";
  }
  // Withdrawal / punishment
  if(/\btake away\b|\bwon'?t let you\b|\bno more\b|\bstop your\b/.test(t)){
    return "Promises only add. They don't take things away.";
  }
  // Coercion
  if(/\byou better\b|\byou have to\b|\byou must\b/.test(t)){
    return "Try framing it as something you're each choosing.";
  }
  return null;
}
function canModifyMemberData(isAdmin,members,userId,memberId){
  if(isAdmin)return true;
  var member=(members||[]).find(function(m){return m.id===memberId;});
  if(!member)return memberId==='joint'||!memberId;
  return member.userId===userId;
}
function isMemberAdmin(member){
  if(!member)return false;
  var roleValue=String(member.accessRole||member.access_role||'').toLowerCase();
  return roleValue==='admin'||roleValue==='co_admin';
}
// Phase A1: Two-tier permission model (PERMISSIONS_SPEC.md).
// Three tiers: 'creator' (users.user_type==='primary'), 'co_admin' (family_members.access_role==='co_admin'),
// 'member' (default). Legacy access_role==='admin' rows are treated as 'co_admin' for backwards compatibility.
function getAccessTier(userType,accessRole){
  if(userType==='primary')return 'creator';
  var r=String(accessRole||'').toLowerCase();
  if(r==='co_admin'||r==='admin')return 'co_admin';
  return 'member';
}
function canTierModifyMember(tier,currentMemberId,targetMemberId){
  if(tier==='creator'||tier==='co_admin')return true;
  if(!targetMemberId||targetMemberId==='joint')return true; // joint/unscoped data is owner-less; permit
  return targetMemberId===currentMemberId;
}
function canTierModifyFamilySettings(tier){
  return tier==='creator'||tier==='co_admin';
}
// Phase A1: convenience hook that wraps the tier-aware helpers with current-user state from AppContext.
// Components call: var perms=useFamilyPermissions(); if(!perms.canModifyMemberData(t.memberId))return;
// or destructure: var{canModifyMemberData,canModifyFamilySettings,tier}=useFamilyPermissions();
// The destructured names intentionally match PERMISSIONS_SPEC.md so component code reads naturally.
function useFamilyPermissions(){
  var ctx=useApp();
  var userType=ctx&&ctx.userProfile&&ctx.userProfile.user_type;
  var accessRole=ctx&&ctx.currentUserAccessRole;
  var tier=getAccessTier(userType,accessRole);
  var members=(ctx&&ctx.members)||[];
  var userId=ctx&&ctx.userId;
  var currentMember=members.find(function(m){return m.userId===userId;});
  var currentMemberId=currentMember&&currentMember.id;
  return{
    tier:tier,
    currentMemberId:currentMemberId,
    canModifyMemberData:function(targetMemberId){return canTierModifyMember(tier,currentMemberId,targetMemberId);},
    canModifyFamilySettings:function(){return canTierModifyFamilySettings(tier);},
  };
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
  var hasScreen=dayWell.some(function(w){return w.screenHrs!=null || w.screen_hrs!=null;});
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
// Phase 2.1.A: streak counter uses a 4-item rule — 3 meals + screen time.
// Transactions are excluded (money entries are optional; not every member earns).
// Water is target-based, tracked separately. Display "X/5" capture rates and
// daily-percent rendering still use calcDayCompletion above; only the streak
// loops on Home and Reflect call this helper.
function calcStreakCompletion(familyId,date,meals,wellness){
  var iso=isoDate(date);
  var dayMeals=(meals||[]).filter(function(m){return m.family_id===familyId && isoDate(m.date)===iso;});
  function mealOf(type){return dayMeals.some(function(m){return String(m.mealTime||m.meal_time||'').toLowerCase()===type;});}
  if(!mealOf('breakfast'))return false;
  if(!mealOf('lunch'))return false;
  if(!mealOf('dinner'))return false;
  var dayWell=(wellness||[]).filter(function(w){return w.family_id===familyId && w.date===iso;});
  return dayWell.some(function(w){return w.screenHrs!=null || w.screen_hrs!=null;});
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
  if(activity.activity_type==='wellness'){
    if(data.action==='deleted'){
      // deleteWellnessRow writes {action:'deleted', log_type:'wellness'} for whole-row
      // deletes (the row spans water/screen/sleep). If a future code path deletes a
      // single metric and writes a more specific log_type, the chain below catches it.
      var lt=data.log_type||'wellness';
      if(lt==='sleep')return actor+' deleted a sleep log';
      if(lt==='screen_time')return actor+' deleted a screen-time log';
      if(lt==='water')return actor+' deleted a water log';
      return actor+' deleted a wellness log';
    }
    if(data.log_type==='sleep'){
      var sh=Number(data.sleep_hours);
      var sleepStr=isFinite(sh)&&sh>0?(' '+(sh===Math.floor(sh)?sh+'h':sh.toFixed(1)+'h')+' of sleep'):' sleep';
      return actor+' logged'+sleepStr;
    }
    if(data.log_type==='screen_time')return actor+' logged screen time';
    return actor+' logged water';
  }
  if(activity.activity_type==='activity_logged'){
    var typeName=String(data.activity_type||'activity').toLowerCase();
    var dur=Number(data.duration_minutes)||0;
    var who=data.member_name&&data.member_name!==actor?(data.member_name+' '):'';
    var base=actor+(who?(' logged '+who):' logged ')+'a '+dur+' min '+typeName;
    if(data.note)base+=' · '+data.note;
    return base;
  }
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
  if(activity.activity_type==='statement_import')return actor+' imported '+(data.imported_count||0)+' transactions from '+(data.bank_name||'a statement');
  if(activity.activity_type==='shared_goal_contribution')return actor+' contributed ₹'+fmt(data.amount||0)+' to '+(data.goal_name||'a goal');
  if(activity.activity_type==='family')return actor+' joined the family';
  if(activity.activity_type==='promise'){
    if(data.action==='created')return actor+' started a promise: '+data.title;
    if(data.action==='completed')return data.title+' wrapped up, both kept their word';
    if(data.action==='wound_down')return data.title+' wrapped up';
    if(data.action==='cancelled')return data.title+' was set aside';
    if(data.action==='paused')return data.title+' is paused for now';
    return actor+' updated a promise';
  }
  if(activity.activity_type==='promise_reflection'){
    var feltText=data.felt==='good'?'felt good about'
      :data.felt==='mixed'?'had mixed feelings about'
      :data.felt==='not_great'?'reflected on'
      :'reflected on';
    return actor+' '+feltText+' "'+data.title+'"';
  }
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
    // Folder prefix = userId so storage RLS policies (storage.foldername(name)[1] = auth.uid())
    // can match. meal-photos and transaction-photos buckets follow the same pattern as bank-statements.
    var fileName=(userId||'user')+'/'+(prefix||'photo')+'_'+Date.now()+'.'+inferredExt;
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

// Legacy category-color pill (looks up CATS[label]). The design's general
// Pill atom is defined below in DESIGN ATOMS. This stays for the existing
// transaction/category UI until those screens are redesigned.
function CategoryPill({label}){
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

function DateField({label,value,onChange,minimumDate,maximumDate,placeholder,defaultPickerDate}){
  var[show,setShow]=useState(false);
  var theme=useThemeColors();
  function handleChange(event,selectedDate){
    if(Platform.OS==='android')setShow(false);
    if(selectedDate)onChange(selectedDate);
  }
  var hasValue=!!value;
  var pickerInitial=value||defaultPickerDate||new Date();
  return(<View style={{marginBottom:12}}>
    <Text style={[z.inpLabel,{color:theme.textSecondary}]}>{label||'Date'}</Text>
    <TouchableOpacity style={[z.inp,z.dateBtn,{backgroundColor:theme.surface,borderColor:theme.border}]} onPress={function(){setShow(true);}}>
      <Text style={[z.dateBtnTx,{color:hasValue?theme.text:theme.muted}]}>{hasValue?displayDate(value):(placeholder||'Tap to select')}</Text>
      <Text style={[z.cap,{color:theme.muted}]}>{hasValue?'Change':'Select'}</Text>
    </TouchableOpacity>
    {Platform.OS==='web'&&<Text style={[z.cap,{marginTop:6,color:theme.muted}]}>Date picker is not supported on web preview. Use mobile app for calendar picker.</Text>}
    {show&&Platform.OS!=='web'&&<DateTimePicker value={pickerInitial} mode="date" display={Platform.OS==='ios'?'spinner':'default'} minimumDate={minimumDate||undefined} maximumDate={maximumDate||new Date()} onChange={handleChange}/>}
    {show&&Platform.OS==='ios'&&<View style={{marginTop:8}}><SecondaryButton full onPress={function(){setShow(false);}}>Done</SecondaryButton></View>}
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
    <ModalSheet visible={open} title={label||'Select'} onClose={function(){setOpen(false);}}>
      {(options||[]).map(function(opt){
        var sel=opt.value===value;
        return <TouchableOpacity key={String(opt.value)} onPress={function(){onChange&&onChange(opt.value);setOpen(false);}} style={{
          flexDirection:'row',justifyContent:'space-between',alignItems:'center',
          paddingVertical:12,paddingHorizontal:14,marginBottom:6,
          backgroundColor:sel?theme.primaryLight:theme.surface,
          borderRadius:14,
          borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,
        }}>
          <Text style={{fontFamily:sel?FF.sansSemi:FF.sans,fontSize:14,color:sel?theme.primary:theme.text}}>{opt.label}</Text>
          {sel?<Text style={{fontFamily:FF.sansBold,fontSize:14,color:theme.primary}}>✓</Text>:null}
        </TouchableOpacity>;
      })}
    </ModalSheet>
  </View>;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN ATOMS — Olive Grove
// Source: _design/all-screens.jsx atoms section.
// RN translations of the design's web atoms. Use these on redesigned
// screens; legacy primitives (Bar, CategoryPill) stay until consumers
// are migrated.
// ═══════════════════════════════════════════════════════════════

function Caps({children,color,size,ls,style}){
  var theme=useThemeColors();
  return <Text style={[{
    fontFamily:FF.sansBold,fontWeight:'700',
    fontSize:size||10,
    letterSpacing:ls!=null?ls:0.8,
    textTransform:'uppercase',
    color:color||theme.muted,
  },style]}>{children}</Text>;
}

function Hero({label,value,suffix,prefix,size,color,accent}){
  var theme=useThemeColors();
  var fs=size||42;
  var fg=accent||color||theme.text;
  return <View>
    <Caps>{label}</Caps>
    <View style={{flexDirection:'row',alignItems:'baseline',marginTop:6}}>
      {prefix?<Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:fs*0.5,color:fg,opacity:0.85}}>{prefix}</Text>:null}
      <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:fs,letterSpacing:-1.5,color:fg,lineHeight:fs}}>{value}</Text>
      {suffix?<Text style={{fontFamily:FF.sans,fontWeight:'500',fontSize:fs*0.36,color:theme.textSecondary,marginLeft:4}}>{suffix}</Text>:null}
    </View>
  </View>;
}

function Block({children,bg,style,padding}){
  var theme=useThemeColors();
  var resolvedBg=bg!==undefined?bg:theme.surface;
  var pad=padding!=null?padding:18;
  var borderProps=resolvedBg===theme.surface
    ?{borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border}
    :null;
  return <View style={[{backgroundColor:resolvedBg,borderRadius:24,padding:pad},borderProps,style]}>{children}</View>;
}

function Pill({bg,fg,children,style}){
  return <View style={[{
    flexDirection:'row',alignItems:'center',alignSelf:'flex-start',
    paddingVertical:4,paddingHorizontal:10,borderRadius:9999,
    backgroundColor:bg,
  },style]}>
    <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:11,color:fg}}>{children}</Text>
  </View>;
}

function Avatar({name,color,size}){
  var s=size||28;
  var initials=(name||'').split(' ').filter(Boolean).map(function(p){return p.charAt(0);}).slice(0,2).join('').toUpperCase();
  return <View style={{
    width:s,height:s,borderRadius:9999,backgroundColor:color,
    alignItems:'center',justifyContent:'center',
  }}>
    <Text style={{fontFamily:FF.sansBold,fontWeight:'700',color:'#fff',fontSize:s*0.4}}>{initials}</Text>
  </View>;
}

function Progress({value,color,track}){
  var theme=useThemeColors();
  var pct=Math.min(100,Math.max(0,value||0));
  return <View style={{height:6,backgroundColor:track||theme.surfaceElevated,borderRadius:3,overflow:'hidden'}}>
    <View style={{height:'100%',width:pct+'%',backgroundColor:color||theme.primary,borderRadius:3}}/>
  </View>;
}

function PrimaryButton({children,full,accent,ghost,onPress,disabled,style}){
  var theme=useThemeColors();
  var bg,fg;
  if(ghost){bg=theme.surfaceElevated;fg=theme.textSecondary;}
  else if(accent){bg=theme.accent;fg='#fff';}
  else{bg=theme.primary;fg='#fff';}
  return <TouchableOpacity disabled={disabled} onPress={onPress} activeOpacity={0.8} style={[{
    height:48,borderRadius:12,paddingHorizontal:22,
    alignItems:'center',justifyContent:'center',
    backgroundColor:bg,opacity:disabled?0.5:1,
    alignSelf:full?'stretch':'flex-start',
  },style]}>
    <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:14,color:fg,letterSpacing:0.1}}>{children}</Text>
  </TouchableOpacity>;
}

function SecondaryButton({children,full,onPress,disabled,style}){
  var theme=useThemeColors();
  return <TouchableOpacity disabled={disabled} onPress={onPress} activeOpacity={0.8} style={[{
    height:48,borderRadius:12,paddingHorizontal:22,
    alignItems:'center',justifyContent:'center',
    borderWidth:1.5,borderColor:theme.primary,backgroundColor:'transparent',
    opacity:disabled?0.5:1,
    alignSelf:full?'stretch':'flex-start',
  },style]}>
    <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:14,color:theme.primary}}>{children}</Text>
  </TouchableOpacity>;
}

function NavBar({title,leading,trailing,serif}){
  var theme=useThemeColors();
  return <View style={{
    paddingTop:8,paddingBottom:12,paddingHorizontal:16,
    flexDirection:'row',alignItems:'center',
    backgroundColor:theme.bg,
    borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:theme.border,
  }}>
    <View style={{width:44}}>{leading}</View>
    <View style={{flex:1,alignItems:'center'}}>
      <Text numberOfLines={1} style={{
        fontFamily:serif?FF.serif:FF.sansBold,
        fontWeight:serif?'400':'700',
        fontSize:serif?22:17,
        letterSpacing:serif?-0.4:-0.3,
        color:theme.text,
      }}>{title}</Text>
    </View>
    <View style={{width:44,alignItems:'flex-end'}}>{trailing}</View>
  </View>;
}

function TabIcon({name,color,size,active}){
  var s=size||20;
  var sw=active?1.85:1.5;
  var p={width:s,height:s,viewBox:'0 0 24 24',fill:'none',stroke:color,strokeWidth:sw,strokeLinecap:'round',strokeLinejoin:'round'};
  if(name==='home')return <Svg {...p}><Path d="M4 11l8-7 8 7"/><Path d="M6 10v9h12v-9"/><Path d="M10 19v-5h4v5"/></Svg>;
  if(name==='finance')return <Svg {...p}><Path d="M5 9c2-3 5-3 7 0s5 3 7 0"/><Path d="M5 15c2-3 5-3 7 0s5 3 7 0"/></Svg>;
  if(name==='family')return <Svg {...p}><Path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/></Svg>;
  if(name==='wellness')return <Svg {...p}><Path d="M12 4c-3 4-5 7-5 10a5 5 0 0010 0c0-3-2-6-5-10z"/></Svg>;
  if(name==='reflect')return <Svg {...p}><Circle cx="12" cy="12" r="8"/><Path d="M12 4a8 8 0 010 16"/></Svg>;
  return null;
}

function TabBar({active,onChange}){
  var theme=useThemeColors();
  var insets=useSafeAreaInsets();
  var tabs=[
    {id:'home',label:'Home'},
    {id:'finance',label:'Finance'},
    {id:'family',label:'Family'},
    {id:'wellness',label:'Wellness'},
    {id:'reflect',label:'Reflect'},
  ];
  return <View style={{
    flexDirection:'row',
    backgroundColor:theme.surface,
    borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:theme.border,
    paddingTop:8,paddingBottom:Math.max(insets.bottom,18),paddingHorizontal:8,
    gap:4,
  }}>
    {tabs.map(function(t){
      var a=active===t.id;
      return <TouchableOpacity key={t.id} onPress={function(){onChange&&onChange(t.id);}} activeOpacity={0.7} style={{flex:1,alignItems:'center',paddingVertical:4,position:'relative'}}>
        {a?<View style={{position:'absolute',top:-8,width:22,height:2,backgroundColor:theme.accent,borderRadius:2}}/>:null}
        <View style={{
          width:44,height:28,borderRadius:9999,
          alignItems:'center',justifyContent:'center',
          backgroundColor:a?theme.primaryLight:'transparent',
        }}>
          <TabIcon name={t.id} color={a?theme.primary:theme.muted} active={a}/>
        </View>
        <Text style={{
          fontFamily:a?FF.sansBold:FF.sansMed,
          fontSize:10,color:a?theme.text:theme.muted,
          marginTop:3,letterSpacing:0.2,
        }}>{t.label}</Text>
      </TouchableOpacity>;
    })}
  </View>;
}

function ModalSheet({visible,title,onClose,children,scroll}){
  var theme=useThemeColors();
  // scroll defaults to true. Set scroll={false} for modals that own their scrolling
  // (e.g. comments lists with reverse layouts) or whose body is a single fixed block.
  var Body=scroll===false?View:ScrollView;
  var bodyProps=scroll===false?null:{showsVerticalScrollIndicator:false,keyboardShouldPersistTaps:'handled'};
  return <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,backgroundColor:'rgba(0,0,0,0.4)',justifyContent:'flex-end'}}>
      <SwipeDownDismiss onDismiss={onClose}>
        <View style={{
          backgroundColor:theme.bg,
          borderTopLeftRadius:28,borderTopRightRadius:28,
          paddingHorizontal:20,paddingTop:12,paddingBottom:24,maxHeight:'92%',
        }}>
          <View style={{width:36,height:4,borderRadius:2,backgroundColor:theme.muted,alignSelf:'center',marginBottom:16}}/>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <Text style={{fontFamily:FF.serif,fontWeight:'400',fontSize:22,letterSpacing:-0.4,color:theme.text}}>{title||''}</Text>
            <TouchableOpacity onPress={onClose} style={{
              width:32,height:32,borderRadius:9999,
              backgroundColor:theme.surfaceElevated,
              alignItems:'center',justifyContent:'center',
            }}>
              <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:16,color:theme.textSecondary}}>×</Text>
            </TouchableOpacity>
          </View>
          <Body {...(bodyProps||{})}>{children}</Body>
        </View>
      </SwipeDownDismiss>
    </KeyboardAvoidingView>
  </Modal>;
}

// ═══════════════════════════════════════════════════════════════
// v5 ATOMS — Saturated Forest (Part 1/3 · Primitives)
// Source: _design/handoff-v5/fr/atoms.jsx
//
// Convention: V5{Name}. Old atoms (Caps, Hero, Block, PrimaryButton,
// SecondaryButton, Sec, etc.) remain untouched. Phase 2 migrates
// callsites screen-by-screen; a sweep commit at the END of Phase 2
// removes the old atoms and renames V5{Name} → {Name}.
// ═══════════════════════════════════════════════════════════════

// v5 token extensions (member identity palette — used by V5Avatar).
// Conceptually part of the theme tokens layer; lives here to stay
// adjacent to its consumers. V5_CATS lives with V5CategoryPill in 3b.
var V5_MEMBER_COLORS={
  light:['#3D5743','#A8512A','#5E437A','#2C4D6B','#7A4416','#345746','#74436B'],
  dark: ['#9CB59A','#DD9C68','#B4A2D0','#8FBADE','#E6B98F','#9CC9B0','#D8AED1'],
};

// ─── V5Caps ──────────────────────────────────────────────
// Uppercase 10/700 micro-label. Eyebrow above hero numbers, above
// section headers, above small captions.
function V5Caps({children,color,style}){
  var theme=useThemeColors();
  return <Text style={[{
    fontFamily:FF.sansBold,fontWeight:'700',fontSize:10,
    letterSpacing:0.9,textTransform:'uppercase',
    color:color||theme.muted,
  },style]}>{children}</Text>;
}

// ─── V5Hero ──────────────────────────────────────────────
// Big-number-with-respect: Caps eyebrow + large tight number with
// optional prefix (₹) and suffix (/ 8 glasses, days, etc).
// `onTone` flips to onPrimary colors for use inside primary-tone Cards.
function V5Hero({label,value,prefix,suffix,size,color,onTone}){
  var theme=useThemeColors();
  var fs=size||42;
  var fg=color||(onTone?theme.onPrimary:theme.text);
  var labelColor=onTone?(theme.onPrimary+'B3'):theme.muted;
  var subColor=onTone?(theme.onPrimary+'B3'):theme.textSecondary;
  return <View>
    {label?<V5Caps color={labelColor}>{label}</V5Caps>:null}
    <View style={{flexDirection:'row',alignItems:'baseline',marginTop:6}}>
      {prefix?<Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:fs*0.46,color:fg,opacity:0.85,marginRight:2}}>{prefix}</Text>:null}
      <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:fs,letterSpacing:-fs*0.038,color:fg,lineHeight:fs,fontVariant:['tabular-nums']}}>{value}</Text>
      {suffix?<Text style={{fontFamily:FF.sansMed,fontWeight:'500',fontSize:fs*0.32,color:subColor,marginLeft:6}}>{suffix}</Text>:null}
    </View>
  </View>;
}

// ─── V5Avatar ────────────────────────────────────────────
// Circle with photo OR stable-hash-colored initials. ring=true wraps
// in a 2px theme.bg "moat" with a 1.5px primary border (or pass a
// number/color for custom ring).
function V5Avatar({name,color,size,photo,ring,ringColor}){
  var theme=useThemeColors();
  var s=size||28;
  var MC=V5_MEMBER_COLORS[theme.mode==='dark'?'dark':'light'];
  var n=name||'?';
  var idx=n.split('').reduce(function(a,c){return(a+c.charCodeAt(0))%MC.length;},0);
  var bg=color||MC[idx];
  var initials=n.split(/\s+/).map(function(p){return p[0];}).filter(Boolean).slice(0,2).join('').toUpperCase();
  var inner=<View style={{
    width:s,height:s,borderRadius:9999,backgroundColor:bg,
    alignItems:'center',justifyContent:'center',overflow:'hidden',
  }}>
    {photo
      ? <Image source={{uri:photo}} style={{width:s,height:s,borderRadius:9999}}/>
      : <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:Math.max(10,s*0.4),color:theme.onPrimary,letterSpacing:-0.2}}>{initials}</Text>}
  </View>;
  if(!ring)return inner;
  var ringW=ring===true?1.5:ring;
  return <View style={{
    padding:2,borderRadius:9999,backgroundColor:theme.bg,
    borderWidth:ringW,borderColor:ringColor||theme.primary,
  }}>{inner}</View>;
}

// ─── V5AvatarStack ───────────────────────────────────────
// Overlapping avatars + overflow "+N" chip when over `max`.
function V5AvatarStack({names,colors,size,max,gap}){
  var s=size||24;
  var mx=max||4;
  var g=gap||6;
  var arr=names||[];
  var visible=arr.slice(0,mx);
  var overflow=arr.length-mx;
  return <View style={{flexDirection:'row',alignItems:'center'}}>
    {visible.map(function(n,i){
      return <View key={n+i} style={{marginLeft:i===0?0:-g,zIndex:visible.length-i}}>
        <V5Avatar name={n} color={(colors||[])[i]} size={s} ring/>
      </View>;
    })}
    {overflow>0?<View style={{marginLeft:-g,zIndex:0}}>
      <V5AvatarOverflowChip size={s} count={overflow}/>
    </View>:null}
  </View>;
}
function V5AvatarOverflowChip({size,count}){
  var theme=useThemeColors();
  return <View style={{
    width:size,height:size,borderRadius:9999,
    backgroundColor:theme.surfaceElevated,
    alignItems:'center',justifyContent:'center',
    borderWidth:2,borderColor:theme.bg,
  }}>
    <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:Math.max(9,size*0.36),color:theme.textSecondary}}>+{count}</Text>
  </View>;
}

// ─── V5Progress ──────────────────────────────────────────
// Single-value horizontal bar, 6px tall by default.
function V5Progress({value,color,track,height}){
  var theme=useThemeColors();
  var h=height||6;
  var fill=color||theme.primary;
  var tr=track||theme.surfaceElevated;
  var v=Math.max(0,Math.min(100,value||0));
  return <View style={{height:h,backgroundColor:tr,borderRadius:h/2,overflow:'hidden'}}>
    <View style={{height:'100%',width:v+'%',backgroundColor:fill,borderRadius:h/2}}/>
  </View>;
}

// ─── V5PageTitle ─────────────────────────────────────────
// Top-of-tab title. Optional Caps kicker + h1 (or serif display).
// Trailing slot holds an action (typically a "+ Invite"-style link or
// IconBtn from step 3b).
function V5PageTitle({kicker,title,serif,trailing,sub}){
  var theme=useThemeColors();
  var titleStyle=serif?{
    fontFamily:FF.serif,fontWeight:'400',fontSize:32,letterSpacing:-1,
    color:theme.text,lineHeight:34,marginTop:kicker?4:0,
  }:{
    fontFamily:FF.sansBold,fontWeight:'700',fontSize:28,letterSpacing:-0.9,
    color:theme.text,lineHeight:31,marginTop:kicker?4:0,
  };
  return <View style={{paddingHorizontal:20,paddingTop:4,paddingBottom:14,flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'}}>
    <View style={{flex:1,minWidth:0,marginRight:12}}>
      {kicker?<V5Caps>{kicker}</V5Caps>:null}
      <Text style={titleStyle}>{title}</Text>
      {sub?<Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,marginTop:6,lineHeight:19}}>{sub}</Text>:null}
    </View>
    {trailing?<View style={{flexShrink:0,marginTop:kicker?18:4}}>{trailing}</View>:null}
  </View>;
}

// ─── V5SectionHeader ─────────────────────────────────────
// h2 16/700 with optional primary-text action link. Replaces the
// existing 20px <Sec> at Phase 2 sweep. Note: v4-helpers.jsx ships a
// near-twin called SectionH (15/700, with optional `sub` + LivePulse) —
// step 5 will port SectionH separately as V5SectionH; collapse the two
// at sweep time.
function V5SectionHeader({title,action,onAction}){
  var theme=useThemeColors();
  return <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:22,marginBottom:10,paddingHorizontal:20}}>
    <Text style={{fontFamily:FF.sansBold,fontSize:16,fontWeight:'700',letterSpacing:-0.3,color:theme.text}}>{title}</Text>
    {action?<TouchableOpacity onPress={onAction}>
      <Text style={{fontFamily:FF.sansBold,fontSize:12,fontWeight:'700',color:theme.primary,letterSpacing:0.1}}>{action}</Text>
    </TouchableOpacity>:null}
  </View>;
}

// ─── V5NavBar ────────────────────────────────────────────
// Top-of-screen nav for modals + secondary screens. 3-col layout:
// 44px leading slot / centered title / 44px trailing slot.
function V5NavBar({title,leading,trailing,serif}){
  var theme=useThemeColors();
  return <View style={{
    paddingTop:10,paddingBottom:12,paddingHorizontal:16,
    flexDirection:'row',alignItems:'center',
    borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:theme.hairlineSoft,
  }}>
    <View style={{width:44,alignItems:'flex-start'}}>{leading||null}</View>
    <View style={{flex:1,alignItems:'center'}}>
      <Text numberOfLines={1} style={serif?{
        fontFamily:FF.serif,fontWeight:'400',fontSize:20,letterSpacing:-0.3,color:theme.text,
      }:{
        fontFamily:FF.sansBold,fontWeight:'700',fontSize:15,letterSpacing:-0.2,color:theme.text,
      }}>{title||''}</Text>
    </View>
    <View style={{width:44,alignItems:'flex-end'}}>{trailing||null}</View>
  </View>;
}

// ─── V5FRLogo ────────────────────────────────────────────
// "Hearth + heart" brand mark (matches the launcher icon). The
// `wordmark` variant adds "Family Room" in Instrument Serif. `tint`
// overrides the moss roof color (e.g. white when on a primary block).
function V5FRLogo({size,variant,tint}){
  var theme=useThemeColors();
  var s=size||28;
  var pc=tint||theme.primary;
  var ac=theme.accent;
  if(variant==='wordmark'){
    return <View style={{flexDirection:'row',alignItems:'center'}}>
      <V5FRLogo size={s} tint={tint}/>
      <Text style={{fontFamily:FF.serif,fontWeight:'400',fontSize:s*0.85,letterSpacing:-0.5,color:theme.text,marginLeft:10}}>Family Room</Text>
    </View>;
  }
  return <Svg width={s} height={s} viewBox="0 0 64 64">
    <Path d="M14 32 L32 16 L50 32" stroke={pc} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <Path d="M32 46 C27 41 22 37 22 32 a5 5 0 015-5 c2.5 0 4 1.2 5 3 c1-1.8 2.5-3 5-3 a5 5 0 015 5 c0 5-5 9-10 14z" fill={ac}/>
  </Svg>;
}

function MemberStatChip({label,value}){
  var theme=useThemeColors();
  return <View style={{
    backgroundColor:theme.surfaceElevated,
    paddingHorizontal:8,paddingVertical:3,
    borderRadius:9999,flexDirection:'row',
  }}>
    <Text style={{fontFamily:FF.sans,fontSize:10.5,color:theme.muted}}>{label} </Text>
    <Text style={{fontFamily:FF.sansBold,fontSize:10.5,color:theme.text}}>{value}</Text>
  </View>;
}

function MemberStreakRing({member,onPress}){
  var theme=useThemeColors();
  var r=26;
  var c=2*Math.PI*r;
  var streak=Number(member.streak)||0;
  var best=Math.max(Number(member.best)||1,1);
  var pct=Math.min(100,(streak/best)*100);
  var dashOffset=c-(c*pct)/100;
  return <Pressable onPress={onPress} style={function(state){return {
    backgroundColor:theme.surface,
    borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,
    borderRadius:20,padding:14,marginBottom:10,
    opacity:state.pressed?0.7:1,
  };}}>
    <View style={{flexDirection:'row',alignItems:'center'}}>
      <View style={{width:64,height:64,marginRight:12}}>
        <Svg width="64" height="64" viewBox="0 0 64 64">
          <Circle cx="32" cy="32" r={r} fill="none" stroke={theme.surfaceElevated} strokeWidth="5"/>
          <Circle cx="32" cy="32" r={r} fill="none" stroke={theme.accent} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={dashOffset} transform="rotate(-90 32 32)"/>
        </Svg>
        <View style={{position:'absolute',width:64,height:64,alignItems:'center',justifyContent:'center'}}>
          <Text style={{fontFamily:FF.sansBold,fontSize:18,color:theme.text,letterSpacing:-0.5,lineHeight:20}}>{streak}</Text>
          <Text style={{fontFamily:FF.sansBold,fontSize:7.5,color:theme.muted,letterSpacing:0.6,textTransform:'uppercase',marginTop:1}}>Days</Text>
        </View>
      </View>
      <View style={{flex:1,minWidth:0}}>
        <View style={{flexDirection:'row',alignItems:'center'}}>
          <View style={{
            width:26,height:26,borderRadius:13,
            backgroundColor:theme.primaryLight,
            alignItems:'center',justifyContent:'center',marginRight:8,
          }}>
            <Text style={{fontFamily:FF.sansBold,fontSize:10.5,color:theme.primary,letterSpacing:-0.2}}>{member.initials}</Text>
          </View>
          <View style={{flex:1}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
              <Text style={{fontFamily:FF.sansSemi,fontSize:14,color:theme.text,letterSpacing:-0.2}}>{member.name}</Text>
              {member.isYou?<View style={{
                backgroundColor:theme.primaryLight,
                paddingHorizontal:6,paddingVertical:2,borderRadius:9999,marginLeft:6,
              }}>
                <Text style={{fontFamily:FF.sansBold,fontSize:8.5,color:theme.primary,letterSpacing:0.6,textTransform:'uppercase'}}>You</Text>
              </View>:null}
            </View>
            <Text style={{fontFamily:FF.sans,fontSize:11,color:theme.textSecondary,marginTop:1}}>{member.role}</Text>
          </View>
        </View>
        <View style={{flexDirection:'row',marginTop:10,flexWrap:'wrap',gap:5}}>
          <MemberStatChip label="Score" value={member.score}/>
          <MemberStatChip label="Best" value={(Number(member.best)||0)+'d'}/>
          <MemberStatChip label="Hit" value={member.hit}/>
        </View>
      </View>
    </View>
  </Pressable>;
}

function InfoIcon({title,body,color,style}){
  var theme=useThemeColors();
  var[open,setOpen]=useState(false);
  var idle=color||theme.muted;
  return <View style={style||null}>
    <Pressable onPress={function(){setOpen(true);}} hitSlop={{top:6,bottom:6,left:6,right:6}}>
      {function(state){
        var c=state.pressed?theme.primary:idle;
        return <View style={{
          width:16,height:16,borderRadius:9999,
          borderWidth:1.2,borderColor:c,
          alignItems:'center',justifyContent:'center',
        }}>
          <Text style={{fontFamily:FF.serifItalic,fontSize:11,lineHeight:13,color:c,marginTop:-1}}>i</Text>
        </View>;
      }}
    </Pressable>
    <ModalSheet visible={open} title={title} onClose={function(){setOpen(false);}}>
      <Text style={{fontFamily:FF.sans,fontSize:14,lineHeight:21,color:theme.text,marginBottom:18}}>{body}</Text>
      <PrimaryButton full onPress={function(){setOpen(false);}}>Got it</PrimaryButton>
    </ModalSheet>
  </View>;
}

// Phase 2.3 step 2: per-member donut ring used inside Protein Today + Time on Screens heroes.
// Spec: _design/PROTEIN_RING_SPEC.md. Variant-driven so the same atom serves both.
function FamilyMemberRing({member,variant,ringDiameter,ringStroke,onPress,aboveLabel}){
  var theme=useThemeColors();
  var d=ringDiameter||56;
  var sw=ringStroke||(d>=52?4:3.5);
  var cx=d/2;
  var r=cx-sw/2-2;
  var c=2*Math.PI*r;
  var current=Number(member.current)||0;
  var target=Math.max(Number(member.target)||1,1);
  var pct=Math.min(100,(current/target)*100);
  var dashOffset=c-(c*pct)/100;
  var isScreentime=variant==='screentime';
  var arcColor=isScreentime?(current>target?theme.warning:'#fff'):'#fff';
  var trackColor='rgba(255,255,255,0.18)';
  var initSize=d>=52?13:(d>=48?12:11);
  var unitWord=isScreentime?'hours':'grams';
  var a11yLabel=(member.name||'')+': '+current+' of '+target+' '+unitWord+', '+Math.round(pct)+' percent';
  var aboveBlock=aboveLabel?<View style={{marginBottom:4,maxWidth:d+8,alignItems:'center'}}>{aboveLabel}</View>:null;
  var ringSvg=<View style={{width:d,height:d}}>
    <Svg width={d} height={d} viewBox={'0 0 '+d+' '+d}>
      <Circle cx={cx} cy={cx} r={r} fill="none" stroke={trackColor} strokeWidth={sw}/>
      <Circle cx={cx} cy={cx} r={r} fill="none" stroke={arcColor} strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={dashOffset} transform={'rotate(-90 '+cx+' '+cx+')'}/>
    </Svg>
    <View style={{position:'absolute',width:d,height:d,alignItems:'center',justifyContent:'center'}}>
      <Text style={{fontFamily:FF.sansBold,fontSize:initSize,color:'#fff',letterSpacing:-0.2}}>{member.initials||'?'}</Text>
    </View>
  </View>;
  var nameLabel=<Text numberOfLines={1} ellipsizeMode="tail" style={{
    fontFamily:FF.sansSemi,fontSize:11,
    color:'rgba(255,255,255,0.78)',
    marginTop:6,maxWidth:d+8,textAlign:'center',
  }}>{member.name||'?'}</Text>;
  if(onPress){
    return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11yLabel} style={function(state){return{alignItems:'center',flex:1,opacity:state.pressed?0.7:1};}}>
      {aboveBlock}
      {ringSvg}
      {nameLabel}
    </Pressable>;
  }
  return <View accessibilityLabel={a11yLabel} style={{alignItems:'center',flex:1}}>
    {aboveBlock}
    {ringSvg}
    {nameLabel}
  </View>;
}

// Vertical bar — inverse semantics of FamilyMemberRing (fill grows toward a CAP, not toward a goal).
// Used by Time on Screens hero where the daily target is a ceiling, not a target.
// Same prop shape as FamilyMemberRing so callsites swap with a one-line change.
// FamilyMemberBar — vertical fill-bar with initials overlay. Three visual states:
//   (1) NOT LOGGED — member.current is null/undefined. Dashed track, no fill,
//       initials still readable. The bar is "absent" but the slot is reserved
//       so the row layout doesn't shift. aboveLabel typically reads "— / Xh".
//   (2) UNDER OR AT TARGET — proportional white fill (variant: solid empty
//       when current===0, solid partial when 0 < current ≤ target).
//   (3) OVER TARGET — bar fills 100% and switches to theme.warning. A small
//       "▲" sits at the top of the bar to signal overflow non-judgmentally.
//
// Caller passes `current` as null/undefined to opt into the not-logged state.
// Pass 0 explicitly for "logged zero" (track shows, no fill).
function FamilyMemberBar({member,ringDiameter,ringStroke,onPress,aboveLabel}){
  var theme=useThemeColors();
  var d=ringDiameter||56;
  var initSize=d>=52?13:(d>=48?12:11);
  var rawCurrent=member.current;
  var notLogged=(rawCurrent===null||typeof rawCurrent==='undefined');
  var current=notLogged?0:Number(rawCurrent)||0;
  var target=Math.max(Number(member.target)||1,1);
  var pct=Math.min(100,(current/target)*100);
  var overLimit=!notLogged&&current>target;
  var trackColor='rgba(255,255,255,0.18)';
  var fillColor=overLimit?theme.warning:'#fff';
  var barWidth=Math.max(20,Math.round(d*0.45));
  var initialsZone=18; // top zone reserved so the initials stay readable as fill rises
  var maxFillH=d-initialsZone;
  var fillH=notLogged?0:(overLimit?maxFillH:(pct/100)*maxFillH);
  var a11yLabel=notLogged
    ?((member.name||'')+': not logged, target '+target+' hours')
    :((member.name||'')+': '+current+' of '+target+' hours, '+Math.round(pct)+' percent of cap'+(overLimit?' (over)':''));
  var aboveBlock=aboveLabel?<View style={{marginBottom:4,maxWidth:d+8,alignItems:'center'}}>{aboveLabel}</View>:null;
  // Track style switches to dashed-outline + transparent bg when not logged.
  // RN supports borderStyle:'dashed' on Android 6+ and iOS — has been stable for years.
  var trackStyle=notLogged
    ?{width:barWidth,height:d,borderRadius:6,backgroundColor:'transparent',borderWidth:1.5,borderColor:'rgba(255,255,255,0.55)',borderStyle:'dashed',overflow:'hidden',justifyContent:'flex-end'}
    :{width:barWidth,height:d,borderRadius:6,backgroundColor:trackColor,overflow:'hidden',justifyContent:'flex-end'};
  var barViz=<View style={{width:d,height:d,alignItems:'center'}}>
    <View style={trackStyle}>
      {!notLogged?<View style={{height:fillH,backgroundColor:fillColor}}/>:null}
    </View>
    {/* Overflow indicator: small chevron at the top edge of the bar when over target. */}
    {overLimit?<View style={{position:'absolute',top:0,left:0,right:0,alignItems:'center'}}>
      <Text style={{fontFamily:FF.sansBold,fontSize:9,color:'#fff',marginTop:1}}>▲</Text>
    </View>:null}
    <View style={{position:'absolute',top:3,left:0,right:0,alignItems:'center'}}>
      <Text style={{fontFamily:FF.sansBold,fontSize:initSize,color:notLogged?'rgba(255,255,255,0.55)':'#fff',letterSpacing:-0.2}}>{member.initials||'?'}</Text>
    </View>
  </View>;
  var nameLabel=<Text numberOfLines={1} ellipsizeMode="tail" style={{
    fontFamily:FF.sansSemi,fontSize:11,
    color:notLogged?'rgba(255,255,255,0.55)':'rgba(255,255,255,0.78)',
    marginTop:6,maxWidth:d+8,textAlign:'center',
  }}>{member.name||'?'}</Text>;
  if(onPress){
    return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11yLabel} style={function(state){return{alignItems:'center',flex:1,opacity:state.pressed?0.7:1};}}>
      {aboveBlock}
      {barViz}
      {nameLabel}
    </Pressable>;
  }
  return <View accessibilityLabel={a11yLabel} style={{alignItems:'center',flex:1}}>
    {aboveBlock}
    {barViz}
    {nameLabel}
  </View>;
}

// MemberChipStrip — "Whole family" + one chip per member. Mirrors the Wellness tab's chip strip.
// Used by Home, Finance, Reflect to drill into a single member's data while keeping top cards aggregate.
// Pass `gate(memberId)` to veto a tap (e.g. tier='member' tries to view another member's finance):
// return false to block (caller is responsible for showing the alert), true to allow.
function MemberChipStrip({members,selectedId,onSelect,gate}){
  var theme=useThemeColors();
  if(!members||members.length===0)return null;
  function tryPick(nextId){
    if(gate&&!gate(nextId))return;
    haptic('light');
    onSelect(nextId);
  }
  return <View style={{marginBottom:12,marginHorizontal:-20}}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:20,gap:10}}>
      <TouchableOpacity onPress={function(){tryPick(null);}} style={{alignItems:'center',width:72}} accessibilityLabel="Show whole family">
        <View style={{
          width:54,height:54,borderRadius:27,
          backgroundColor:!selectedId?theme.primary:theme.surfaceElevated,
          alignItems:'center',justifyContent:'center',marginBottom:6,
          borderWidth:2,borderColor:!selectedId?theme.primary:theme.background,
        }}>
          <Text style={{fontSize:14,fontWeight:'700',color:!selectedId?'#FFFFFF':theme.text}}>All</Text>
        </View>
        <Text style={{fontSize:11,fontWeight:'600',color:theme.text}} numberOfLines={1}>Whole family</Text>
      </TouchableOpacity>
      {members.map(function(m,i){
        var slot=SLOTS[i%5];
        var sel=selectedId===m.id;
        return <TouchableOpacity key={'mchip_'+m.id} onPress={function(){tryPick(sel?null:m.id);}} style={{alignItems:'center',width:72}} accessibilityLabel={m.name} accessibilityState={{selected:sel}}>
          <View style={{
            width:54,height:54,borderRadius:27,
            backgroundColor:slot.bg,
            alignItems:'center',justifyContent:'center',marginBottom:6,
            borderWidth:sel?3:2,borderColor:sel?theme.primary:theme.background,
          }}>
            <Text style={{fontSize:18,fontWeight:'700',color:slot.text}}>{(m.name||'?')[0]}</Text>
          </View>
          <Text style={{fontSize:11,fontWeight:'600',color:sel?theme.primary:theme.text}} numberOfLines={1}>{m.name}</Text>
        </TouchableOpacity>;
      })}
    </ScrollView>
  </View>;
}

function DayDetailModal({visible,date,onClose,onChangeDate,onEditTransaction,onEditMeal,onAddTransaction,onAddMeal,onAddWater,onAddScreen,onAddGoal}){
  var theme=useThemeColors();
  var{transactions,meals,wellness,goals,sharedGoals,sharedGoalContributions,waterTrackingEnabled}=useApp();
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
  var titleStr=focusDate.toLocaleDateString('en-IN',{weekday:'short',month:'short',day:'numeric'});

  return <ModalSheet visible={visible} title={titleStr} onClose={onClose}>
    {/* Date stepper */}
    <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
      <View style={{flex:1}}><SecondaryButton full onPress={function(){onChangeDate&&onChangeDate(addDays(focusDate,-1));}}>‹ Prev</SecondaryButton></View>
      <View style={{flex:1}}><SecondaryButton full onPress={function(){onChangeDate&&onChangeDate(new Date());}}>Today</SecondaryButton></View>
      <View style={{flex:1}}><SecondaryButton full onPress={function(){onChangeDate&&onChangeDate(addDays(focusDate,1));}}>Next ›</SecondaryButton></View>
    </View>

    {!hasData&&<Block style={{padding:18,marginBottom:14,alignItems:'center'}}>
      <Caps color={theme.muted} style={{marginBottom:10}}>No logs for this day</Caps>
      <PrimaryButton onPress={function(){onAddTransaction&&onAddTransaction(focusDate);}}>+ Capture an entry</PrimaryButton>
    </Block>}

    {hasData&&<View>
      {/* Transactions */}
      <Caps style={{marginBottom:8}}>Transactions · {dayTx.length}</Caps>
      <Block style={{padding:14,marginBottom:12}}>
        {dayTx.length===0?<Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted}}>No entries.</Text>:
        incomeTx.concat(expenseTx).slice(0,20).map(function(t,i,arr){
          var isLast=i===arr.length-1;
          return <TouchableOpacity key={t.id} activeOpacity={0.7} onPress={function(){if(onEditTransaction)onEditTransaction(t);else Alert.alert('Open Finance','Go to Finance tab to edit this transaction.');}} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10,borderBottomWidth:isLast?0:StyleSheet.hairlineWidth,borderBottomColor:theme.border}}>
            <View style={{flex:1}}>
              <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:14,color:theme.text}}>{t.merchant}</Text>
              <Caps color={theme.muted} style={{marginTop:2}}>{t.memberName||'Joint'} · {t.category}</Caps>
            </View>
            <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:14,color:t.category==='Income'?theme.primary:theme.text}}>{t.category==='Income'?'+':'−'}₹{fmt(Math.abs(Number(t.amount)||0))}</Text>
          </TouchableOpacity>;
        })}
      </Block>

      {/* Meals */}
      <Caps style={{marginBottom:8}}>Meals · {dayMeals.length}</Caps>
      <Block style={{padding:14,marginBottom:12}}>
        {dayMeals.length===0?<Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted}}>No meals on this day.</Text>:
        ['breakfast','lunch','dinner','snack'].map(function(mt){
          var rows=mealsByType[mt]||[];
          if(rows.length===0)return null;
          return <View key={mt} style={{marginBottom:8}}>
            <Caps>{mt}</Caps>
            {rows.map(function(m){return <TouchableOpacity key={m.id} activeOpacity={0.7} onPress={function(){onEditMeal&&onEditMeal(m);}} style={{paddingVertical:6}}>
              <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.text}}>{m.items}</Text>
              <Caps color={theme.muted} style={{marginTop:2}}>{m.memberName||'Member'} · {m.protein||0}g protein</Caps>
            </TouchableOpacity>;})}
          </View>;
        })}
      </Block>

      {/* Wellness */}
      <Caps style={{marginBottom:8}}>Wellness · {dayWell.length}</Caps>
      <Block style={{padding:14,marginBottom:12}}>
        {dayWell.length===0?<Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted}}>No wellness logs.</Text>:
        dayWell.map(function(w,i,arr){
          var isLast=i===arr.length-1;
          return <TouchableOpacity key={w.id||((w.memberId||'m')+'_'+w.date)} activeOpacity={0.7} onPress={function(){haptic('light');if(w.screenHrs||w.screen_hrs){onAddScreen&&onAddScreen(toDate(w.date));}else if((w.water||0)>0){onAddWater&&onAddWater(toDate(w.date));}else{onAddScreen&&onAddScreen(toDate(w.date));}}} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10,borderBottomWidth:isLast?0:StyleSheet.hairlineWidth,borderBottomColor:theme.border}}>
            <View style={{flex:1}}>
              <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:14,color:theme.text}}>{w.memberName||'Member'}</Text>
              <Caps color={theme.muted} style={{marginTop:2}}>{waterTrackingEnabled?'Water: '+formatWaterFromLitres(w.water||0)+' · ':''}Screen: {(w.screenHrs!=null||w.screen_hrs!=null)?(w.screenHrs??w.screen_hrs)+'h':'\u2014'}</Caps>
            </View>
            <Caps color={theme.primary}>Edit ›</Caps>
          </TouchableOpacity>;
        })}
      </Block>

      {/* Goals snapshot */}
      {((goals||[]).length>0||(sharedGoals||[]).length>0||dayContribs.length>0)&&<View>
        <Caps style={{marginBottom:8}}>Goals progress</Caps>
        <Block style={{padding:14,marginBottom:12}}>
          {(goals||[]).slice(0,5).map(function(g){var pct=g.target>0?Math.round((g.current/g.target)*100):0;return <View key={g.id} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:4}}><Text style={{fontFamily:FF.sans,fontSize:13,color:theme.text,flex:1,marginRight:8}} numberOfLines={1}>{g.name}</Text><Caps color={theme.primary}>{pct}%</Caps></View>;})}
          {(sharedGoals||[]).slice(0,3).map(function(g){var pct=g.target_amount>0?Math.round((Number(g.current_amount||0)/Number(g.target_amount))*100):0;return <View key={g.id} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:4}}><Text style={{fontFamily:FF.sans,fontSize:13,color:theme.text,flex:1,marginRight:8}} numberOfLines={1}>Shared: {g.goal_name}</Text><Caps color={theme.accent}>{pct}%</Caps></View>;})}
          {dayContribs.length>0&&<Caps color={theme.muted} style={{marginTop:6}}>Contributions today: {dayContribs.length}</Caps>}
        </Block>
      </View>}
    </View>}

    <View style={{flexDirection:'row',gap:8,marginTop:4}}>
      <View style={{flex:1}}><PrimaryButton full onPress={function(){onAddTransaction&&onAddTransaction(focusDate);}}>+ Tx</PrimaryButton></View>
      <View style={{flex:1}}><SecondaryButton full onPress={function(){onAddMeal&&onAddMeal(focusDate);}}>+ Meal</SecondaryButton></View>
      <View style={{flex:1}}><SecondaryButton full onPress={function(){onAddScreen&&onAddScreen(focusDate);}}>+ Screen</SecondaryButton></View>
    </View>
  </ModalSheet>;
}

function UnifiedCalendarModal({visible,onClose,context,selectedDate,onSelectDate,onOpenDayDetail}){
  var theme=useThemeColors();
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

  var monthTitle=currentMonth.toLocaleString('en-IN',{month:'long',year:'numeric'});
  return <ModalSheet visible={visible} title={monthTitle} onClose={onClose}>
    {/* Month stepper */}
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
      <TouchableOpacity onPress={function(){setCurrentMonth(new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1));}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
        <Caps color={theme.primary}>‹ Prev</Caps>
      </TouchableOpacity>
      <Caps color={theme.muted}>From {context==='finance'?'Finance':context==='wellness'?'Wellness':'Reflections'}</Caps>
      <TouchableOpacity onPress={function(){setCurrentMonth(new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1));}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
        <Caps color={theme.primary}>Next ›</Caps>
      </TouchableOpacity>
    </View>

    {/* Day-of-week header */}
    <View style={{flexDirection:'row',marginBottom:6}}>
      {['M','T','W','T','F','S','S'].map(function(d,idx){return <View key={d+'_'+idx} style={{flex:1,alignItems:'center',paddingVertical:4}}><Caps color={theme.muted} ls={0.4}>{d}</Caps></View>;})}
    </View>

    {/* 6×7 grid */}
    <View style={{flexDirection:'row',flexWrap:'wrap'}}>
      {cells.map(function(d){
        var inMonth=d.getMonth()===currentMonth.getMonth();
        var stats=cellStats(d);
        var isSel=isoDate(d)===selectedISO;
        var dot=stats.tx>0||stats.meal>0||stats.well>0||stats.recur>0;
        var dotIsAccent=context==='finance'?stats.recur>0:(context==='wellness'?stats.well>0:false);
        return <TouchableOpacity key={isoDate(d)} activeOpacity={0.7} style={{
          width:'14.285%',aspectRatio:1,padding:2,
        }} onPress={function(){
          setLocalSelected(d);
          onSelectDate&&onSelectDate(d);
          if(onOpenDayDetail){onClose&&onClose();onOpenDayDetail(d,context);}
        }}>
          <View style={{
            flex:1,borderRadius:10,alignItems:'center',justifyContent:'center',
            backgroundColor:isSel?theme.primary:'transparent',
          }}>
            <Text style={{
              fontFamily:FF.sansSemi,fontSize:13,fontWeight:'600',
              color:isSel?'#fff':(inMonth?theme.text:theme.muted),
            }}>{d.getDate()}</Text>
            {dot&&!isSel&&<View style={{
              position:'absolute',bottom:6,
              width:4,height:4,borderRadius:9999,
              backgroundColor:dotIsAccent?theme.accent:theme.primary,
            }}/>}
          </View>
        </TouchableOpacity>;
      })}
    </View>

    {/* Selected day stats */}
    <Caps style={{marginTop:18,marginBottom:8}}>{localSelected.toLocaleDateString('en-IN',{weekday:'long',month:'long',day:'numeric'})}</Caps>
    <View style={{gap:8}}>
      {context!=='wellness'&&<Block bg={theme.primaryLight} style={{padding:14}}>
        <Caps color={theme.primary}>Transactions</Caps>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:22,letterSpacing:-0.6,color:theme.primary,marginTop:4}}>{selectedStats.tx}<Text style={{fontSize:12,fontWeight:'500',color:theme.textSecondary}}>{selectedStats.recur>0?' · '+selectedStats.recur+' recurring due':''}</Text></Text>
      </Block>}
      <Block style={{padding:14}}>
        <Caps>Meals · Wellness</Caps>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:22,letterSpacing:-0.6,color:theme.text,marginTop:4}}>{selectedStats.meal}<Text style={{fontSize:12,fontWeight:'500',color:theme.textSecondary}}> meals · {selectedStats.well} logs</Text></Text>
      </Block>
      <Block style={{padding:14}}>
        <Caps>Day completion</Caps>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:22,letterSpacing:-0.6,color:theme.text,marginTop:4}}>{selectedStats.completion.percent}%</Text>
      </Block>
    </View>
  </ModalSheet>;
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
  // Email-auth STEP 4: when signUp returns no session (Supabase confirmation required),
  // we show a "Check your email" interstitial instead of routing to questionnaire.
  // pendingConfirmation = {email} when interstitial active; null when form active.
  var[pendingConfirmation,setPendingConfirmation]=useState(null);
  var[resending,setResending]=useState(false);

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
      // Email confirmation required: Supabase returns user but no session until the link is clicked.
      // Show the interstitial; the deep-link handler in App.js picks up the confirmation link's PKCE
      // code, exchanges it, and AppCore's onAuthStateChange routes the user into the app.
      // Skip ensurePublicUser here — checkAuthState at AppCore.js L6660+ creates the public.users row
      // after confirmation, so unconfirmed signups don't leave orphan rows.
      var session=authRes.data&&authRes.data.session;
      if(!session){
        console.log('[AUTH] Signup pending email confirmation for',safeEmail);
        setPendingConfirmation({email:safeEmail,kind:'signup'});
        haptic('success');
        return;
      }
      // Session present: confirmation isn't required (Supabase setting off). Existing instant-signin flow.
      var authUser=authRes.data&&authRes.data.user;
      if(!authUser||!authUser.id){
        Alert.alert('Error','Could not get user account after signup. Please try login.');
        return;
      }
      console.log('[AUTH] Signup auth successful (instant session) user id:',authUser.id);
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

  async function handleResend(){
    if(!pendingConfirmation||!pendingConfirmation.email)return;
    haptic('light');
    setResending(true);
    try{
      var res;
      if(pendingConfirmation.kind==='reset'){
        res=await supabase.auth.resetPasswordForEmail(pendingConfirmation.email,{redirectTo:'wellthyfam://reset-password'});
      }else{
        res=await supabase.auth.resend({type:'signup',email:pendingConfirmation.email});
      }
      if(res&&res.error){
        console.log('[AUTH] Resend error:',res.error);
        Alert.alert('Could not resend',res.error.message||'Please try again in a moment.');
      }else{
        Alert.alert('Email sent','We resent the link to '+pendingConfirmation.email+'.');
      }
    }catch(e){
      console.log('[AUTH] Resend fatal error:',e);
      Alert.alert('Error',e.message||'Could not resend');
    }finally{
      setResending(false);
    }
  }

  function handleDifferentEmail(){
    setPendingConfirmation(null);
    setEmail('');
    setPass('');
  }

  // STEP 5: Forgot password flow. Validates email, sends reset link, shows interstitial in 'reset' mode.
  async function handleForgotPassword(){
    var safeEmail=String(email||'').trim().toLowerCase();
    if(!safeEmail){Alert.alert('Enter your email','Please type your email above first, then tap "Forgot password?" again.');return;}
    haptic('light');
    setLoading(true);
    try{
      console.log('[AUTH] Forgot password requested for:',safeEmail);
      var res=await supabase.auth.resetPasswordForEmail(safeEmail,{redirectTo:'wellthyfam://reset-password'});
      if(res&&res.error){
        console.log('[AUTH] Forgot password error:',res.error);
        Alert.alert('Could not send reset',res.error.message||'Please try again.');
        return;
      }
      setPendingConfirmation({email:safeEmail,kind:'reset'});
      haptic('success');
    }catch(e){
      console.log('[AUTH] Forgot password fatal:',e);
      Alert.alert('Error',e.message||'Could not send reset email');
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

      // Fix 2 (build #6) — when a deferred-invite-join is pending for THIS auth user, do NOT
      // fall through to ensurePublicUser('primary'). The auth listener's checkAuthState drain
      // will run with this same SIGNED_IN event and write the row with user_type='member' +
      // family_id from the invite payload. Routing here would race the drain and (worse) the
      // ensurePublicUser INSERT below would hardcode user_type='primary', which is the bug we
      // saw with ethiven44@gmail.com on build #5: the user ended up self-creating a family
      // instead of joining the inviting one.
      try{
        var pendingRaw=await AsyncStorage.getItem('pendingInviteJoin');
        if(pendingRaw){
          var parsed=JSON.parse(pendingRaw);
          var matches=parsed&&parsed.auth_user_id===authUser.id;
          await diagLog('handleLogin pendingInviteJoin check. found=true matches='+matches+' parsedUid='+(parsed&&parsed.auth_user_id)+' authUid='+authUser.id);
          if(matches){
            // Hand off to checkAuthState's drain. Don't navigate — the auth listener will.
            return;
          }
        }else{
          await diagLog('handleLogin pendingInviteJoin check. found=false authUid='+authUser.id);
        }
      }catch(e){
        await diagLog('handleLogin pendingInviteJoin read threw: '+(e&&e.message));
        // Fall through — better to attempt normal login than to block the user on a storage error.
      }

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
    <View style={{flex:1,backgroundColor:theme.bg}}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg}/>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView contentContainerStyle={{flexGrow:1,paddingTop:ins.top+36,paddingHorizontal:24,paddingBottom:24}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {pendingConfirmation?(<View style={{flex:1}}>
            <Caps color={theme.primary}>Wellthy Fam</Caps>
            <Text style={{fontFamily:FF.serifItalic,fontSize:40,letterSpacing:-1.2,color:theme.text,marginTop:12,lineHeight:42}}>
              Check your{'\n'}email.
            </Text>
            <Text style={{fontFamily:FF.sans,fontSize:15,color:theme.textSecondary,marginTop:18,lineHeight:23}}>
              We sent a {pendingConfirmation.kind==='reset'?'password reset':'confirmation'} link to{' '}
              <Text style={{fontFamily:FF.sansSemi,color:theme.text}}>{pendingConfirmation.email}</Text>.
              Tap the link to {pendingConfirmation.kind==='reset'?'set a new password':'finish setting up your account'}.
            </Text>
            <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted,marginTop:24,lineHeight:18}}>
              The email comes from Wellthy Fam {'<'}onboarding@resend.dev{'>'}. Check your spam folder if you don't see it within a minute.
            </Text>
            <View style={{flex:1,minHeight:32}}/>
            <SecondaryButton full disabled={resending} onPress={handleResend}>
              {resending?'Sending…':'Resend email'}
            </SecondaryButton>
            <TouchableOpacity onPress={handleDifferentEmail} style={{marginTop:18,alignItems:'center',paddingVertical:8}}>
              <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.primary}}>
                Use a different email
              </Text>
            </TouchableOpacity>
          </View>):(<View style={{flex:1}}>
            <Caps color={theme.primary}>Wellthy Fam</Caps>
            <Text style={{fontFamily:FF.serifItalic,fontSize:40,letterSpacing:-1.2,color:theme.text,marginTop:12,lineHeight:42}}>
              {isSignup?'Build your\nfamily’s story.':'Welcome\nback.'}
            </Text>
            <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,marginTop:12,lineHeight:21,maxWidth:280}}>
              {isSignup?'Money, health, and small daily wins — kept together by the people who matter.':'Pick up right where you left off.'}
            </Text>

            <View style={{flexDirection:'row',backgroundColor:theme.surfaceElevated,borderRadius:12,padding:4,marginTop:32,marginBottom:24}}>
              <TouchableOpacity style={{flex:1,paddingVertical:11,alignItems:'center',borderRadius:8,backgroundColor:isSignup?theme.surface:'transparent'}} onPress={function(){setIsSignup(true);}}>
                <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:isSignup?theme.primary:theme.textSecondary}}>Sign Up</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{flex:1,paddingVertical:11,alignItems:'center',borderRadius:8,backgroundColor:!isSignup?theme.surface:'transparent'}} onPress={function(){setIsSignup(false);}}>
                <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:!isSignup?theme.primary:theme.textSecondary}}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <Caps style={{marginBottom:8}}>Email</Caps>
            <TextInput
              style={{height:48,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,borderRadius:12,paddingHorizontal:16,fontFamily:FF.sans,fontSize:15,color:theme.text,backgroundColor:theme.surface,marginBottom:16}}
              placeholder="you@email.com" placeholderTextColor={theme.muted}
              value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />

            <Caps style={{marginBottom:8}}>Password</Caps>
            <TextInput
              style={{height:48,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,borderRadius:12,paddingHorizontal:16,fontFamily:FF.sans,fontSize:15,color:theme.text,backgroundColor:theme.surface,marginBottom:32}}
              placeholder="Min 6 characters" placeholderTextColor={theme.muted}
              value={pass} onChangeText={setPass} secureTextEntry
            />

            {!isSignup?<TouchableOpacity onPress={handleForgotPassword} disabled={loading} style={{alignSelf:'flex-start',marginTop:-20,marginBottom:14,paddingVertical:6}}>
              <Text style={{fontFamily:FF.sansSemi,fontSize:13,fontWeight:'600',color:theme.primary}}>Forgot password?</Text>
            </TouchableOpacity>:null}

            <View style={{flex:1,minHeight:24}}/>

            <PrimaryButton full disabled={loading} onPress={function(){if(isSignup)handleSignup();else handleLogin();}}>
              {loading?'Please wait…':isSignup?'Create account':'Sign in'}
            </PrimaryButton>

            <TouchableOpacity onPress={function(){onWantJoin&&onWantJoin();}} style={{marginTop:18,alignItems:'center',paddingVertical:8}}>
              <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.primary}}>
                Have an invite code? <Text style={{textDecorationLine:'underline'}}>Join your family</Text>
              </Text>
            </TouchableOpacity>
            {/* Diagnostics (build #5) — small footer affordance reachable when user can't sign in */}
            <TouchableOpacity onPress={function(){haptic('light');shareDiagLogs();}} style={{marginTop:6,alignItems:'center',paddingVertical:6}}>
              <Text style={{fontFamily:FF.sans,fontSize:11,color:theme.muted}}>Send debug logs</Text>
            </TouchableOpacity>
          </View>)}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// STEP 5: Reset password screen. Mounted when PASSWORD_RECOVERY fires from a deep-link exchange.
// User enters new + confirm; on submit auth.updateUser({password}) succeeds → onComplete clears
// recoveryPendingRef and re-runs checkAuthState which routes the user based on their state.
function ResetPasswordScreen({onComplete,onCancel}){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var[newPass,setNewPass]=useState('');
  var[confirmPass,setConfirmPass]=useState('');
  var[loading,setLoading]=useState(false);
  async function handleSubmit(){
    if(!newPass||newPass.length<6){Alert.alert('Validation','Password must be at least 6 characters.');return;}
    if(newPass!==confirmPass){Alert.alert('Validation',"Passwords don't match.");return;}
    haptic('light');
    setLoading(true);
    try{
      var res=await supabase.auth.updateUser({password:newPass});
      if(res&&res.error){
        console.log('[AUTH] updateUser (reset) error:',res.error);
        Alert.alert('Could not update',res.error.message||'Please try again.');
        return;
      }
      haptic('success');
      onComplete&&onComplete();
    }catch(e){
      console.log('[AUTH] updateUser (reset) fatal:',e);
      Alert.alert('Error',e.message||'Could not update password');
    }finally{
      setLoading(false);
    }
  }
  return(
    <View style={{flex:1,backgroundColor:theme.bg}}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg}/>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView contentContainerStyle={{flexGrow:1,paddingTop:ins.top+36,paddingHorizontal:24,paddingBottom:24}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Caps color={theme.primary}>Wellthy Fam</Caps>
          <Text style={{fontFamily:FF.serifItalic,fontSize:40,letterSpacing:-1.2,color:theme.text,marginTop:12,lineHeight:42}}>
            Set a new{'\n'}password.
          </Text>
          <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,marginTop:12,lineHeight:21}}>
            You're signed in via the reset link. Pick a new password to continue.
          </Text>

          <Caps style={{marginTop:32,marginBottom:8}}>New password</Caps>
          <TextInput
            style={{height:48,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,borderRadius:12,paddingHorizontal:16,fontFamily:FF.sans,fontSize:15,color:theme.text,backgroundColor:theme.surface,marginBottom:16}}
            placeholder="Min 6 characters" placeholderTextColor={theme.muted}
            value={newPass} onChangeText={setNewPass} secureTextEntry
          />
          <Caps style={{marginBottom:8}}>Confirm new password</Caps>
          <TextInput
            style={{height:48,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,borderRadius:12,paddingHorizontal:16,fontFamily:FF.sans,fontSize:15,color:theme.text,backgroundColor:theme.surface,marginBottom:32}}
            placeholder="Re-enter password" placeholderTextColor={theme.muted}
            value={confirmPass} onChangeText={setConfirmPass} secureTextEntry
          />

          <View style={{flex:1,minHeight:24}}/>

          <PrimaryButton full disabled={loading} onPress={handleSubmit}>
            {loading?'Updating…':'Set new password'}
          </PrimaryButton>

          <TouchableOpacity onPress={onCancel} style={{marginTop:18,alignItems:'center',paddingVertical:8}}>
            <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.textSecondary}}>
              Cancel and sign out
            </Text>
          </TouchableOpacity>
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
  var[pendingConfirmation,setPendingConfirmation]=useState(null);
  var[resending,setResending]=useState(false);
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
      // Defensive re-check: someone else might have used this invite during lookup→submit window
      var freshInvite=await supabase.from('family_invites').select('id,status,used_by').eq('id',preview.invite.id).maybeSingle();
      if(freshInvite.error)throw freshInvite.error;
      if(!freshInvite.data||freshInvite.data.status!=='pending'||freshInvite.data.used_by){
        Alert.alert('Invite no longer valid','This invite was used by another person. Ask family admin for a new code.');
        setLoading(false);
        return;
      }

      var safeEmail=String(email||'').trim().toLowerCase();
      var authResult=await supabase.auth.signUp({email:safeEmail,password:pass});

      // Diag (a) — post-signUp, pre-branch. Captures the exact shape of authResult
      // before any decision logic runs, so we can prove which branch SHOULD have fired.
      await diagLog('signUp returned. err='+(authResult&&authResult.error&&authResult.error.message)
        +' hasUser='+!!(authResult&&authResult.data&&authResult.data.user)
        +' hasSession='+!!(authResult&&authResult.data&&authResult.data.session)
        +' sessionUid='+((authResult&&authResult.data&&authResult.data.session&&authResult.data.session.user&&authResult.data.session.user.id)||'none'));

      if(authResult.error&&String(authResult.error.message||'').toLowerCase().includes('already registered')){
        authResult=await supabase.auth.signInWithPassword({email:safeEmail,password:pass});
        await diagLog('signInWithPassword fallback fired. err='+(authResult&&authResult.error&&authResult.error.message)
          +' hasSession='+!!(authResult&&authResult.data&&authResult.data.session));
      }
      if(authResult.error)throw authResult.error;
      var uid=authResult.data&&authResult.data.user&&authResult.data.user.id;
      if(!uid)throw new Error('Could not get user id after signup');
      var session=authResult.data&&authResult.data.session;

      // b1-fix-A — strict session-shape check. The previous loose `if(!session)` could in
      // principle let through `{}` or any truthy non-session value (Hermes coercion edge,
      // supabase-js behaviour change, etc.). Require a real string access_token AND that
      // session.user.id matches the uid we're about to write — anything else means we
      // CANNOT prove auth.uid()===uid server-side, so we must defer.
      var hasRealSession=!!(session
        && typeof session==='object'
        && typeof session.access_token==='string'
        && session.access_token.length>0
        && session.user
        && session.user.id===uid);

      // b1-fix-B — belt-and-braces. Even when hasRealSession passes, ask the supabase
      // client what session it CURRENTLY holds (via getSession). If the client's adopted
      // session doesn't match uid, the next REST call won't carry the right JWT and the
      // upsert will be rejected by RLS. Defer instead.
      var liveOk=false;
      if(hasRealSession){
        try{
          var live=await supabase.auth.getSession();
          var liveUid=live&&live.data&&live.data.session&&live.data.session.user&&live.data.session.user.id;
          liveOk=(liveUid===uid);
          await diagLog('inline-path candidate. uid='+uid+' email='+safeEmail+' liveSessionUid='+(liveUid||'none')+' liveOk='+liveOk);
        }catch(e){
          await diagLog('getSession threw: '+(e&&e.message));
          liveOk=false;
        }
      }else{
        await diagLog('hasRealSession=false → defer. session='+(session?'truthy':'null')
          +' accessTokenStr='+(!!(session&&typeof session.access_token==='string'&&session.access_token.length>0))
          +' sessionUserId='+((session&&session.user&&session.user.id)||'none')+' uid='+uid);
      }

      if(!hasRealSession || !liveOk){
        // Defer all writes until SIGNED_IN fires post-deep-link. AppCore's onAuthStateChange
        // picks this up from AsyncStorage and completes the users / family_members /
        // family_invites writes under a real authenticated session.
        await diagLog('deferring. hasRealSession='+hasRealSession+' liveOk='+liveOk+' uid='+uid+' email='+safeEmail);
        await AsyncStorage.setItem('pendingInviteJoin',JSON.stringify({
          kind:'invite_join',
          invite_id:preview.invite.id,
          invite_code:code,
          family_id:preview.invite.family_id,
          invited_member_name:preview.invite.invited_member_name||null,
          invited_member_role:preview.invite.invited_member_role||null,
          invited_access_role:preview.invite.invited_access_role||'member',
          invited_by:preview.invite.invited_by||null,
          auth_user_id:uid,
          email:safeEmail,
          created_at:new Date().toISOString(),
        }));
        console.log('[INVITE JOIN] signup pending email confirmation for',safeEmail);
        setPendingConfirmation({email:safeEmail,kind:'invite_join',familyName:(preview.family&&preview.family.family_name)||null});
        haptic('success');
        setLoading(false);
        return;
      }

      // Diag (b) — inline-write path firing. Only reachable when BOTH gates pass.
      // If a future RLS rejection happens, the diag log proves the inline path ran with
      // a session that the client claimed was valid for this uid.
      await diagLog('inline path firing. uid='+uid+' email='+safeEmail);

      // Session present, real-shaped, and adopted by the supabase client for this uid.
      // Safe to run inline writes — auth.uid() server-side will equal uid.
      var userUpsert=await supabase.from('users').upsert({
        [DB_COLUMNS.USERS.ID]:uid,
        [DB_COLUMNS.USERS.AUTH_USER_ID]:uid,
        [DB_COLUMNS.USERS.USER_TYPE]:'member',
        [DB_COLUMNS.USERS.EMAIL]:safeEmail,
        [DB_COLUMNS.USERS.NAME]:preview.invite.invited_member_name||((safeEmail||'').split('@')[0])||'Member',
        family_id:preview.invite.family_id,
        [DB_COLUMNS.USERS.QUESTIONNAIRE_COMPLETED]:false,
        [DB_COLUMNS.USERS.QUESTIONNAIRE_DATA]:{invite_code:code,invited_member_name:preview.invite.invited_member_name||null,invited_member_role:preview.invite.invited_member_role||null},
      }).select().single();
      if(userUpsert.error)throw userUpsert.error;

      // Fix V (build #8) — family_members table does NOT have an invited_by column
      // (verified against information_schema). Trying to insert it caused every drain
      // attempt to fail silently with "column invited_by of relation family_members
      // does not exist", which is THE root cause of the questionnaire-loop bug for
      // tsp.chinnu and the missing-family_members-row bug. The "who invited me"
      // relationship is preserved via family_invites.invited_by + invite_code linkage.
      await supabase.from('family_members').insert({
        family_id:preview.invite.family_id,
        user_id:uid,
        role:(preview.invite.invited_member_role||'parent').toLowerCase(),
        access_role:preview.invite.invited_access_role||'member',
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

  async function handleResend(){
    if(!pendingConfirmation||!pendingConfirmation.email)return;
    haptic('light');
    setResending(true);
    try{
      var res=await supabase.auth.resend({type:'signup',email:pendingConfirmation.email});
      if(res&&res.error){
        console.log('[INVITE JOIN RESEND ERROR]',res.error);
        Alert.alert('Could not resend',res.error.message||'Please try again.');
      }else{
        Alert.alert('Email sent','We resent the link to '+pendingConfirmation.email+'.');
      }
    }catch(e){
      console.log('[INVITE JOIN RESEND FATAL]',e);
      Alert.alert('Error',e.message||'Could not resend email');
    }finally{
      setResending(false);
    }
  }

  async function handleDifferentEmail(){
    haptic('light');
    await diagLog('handleDifferentEmail (explicit) — clearing pendingInviteJoin and signing out');
    try{await AsyncStorage.removeItem('pendingInviteJoin');}catch(e){console.log('[INVITE JOIN] clear pending failed',e);}
    try{await supabase.auth.signOut();}catch(e){console.log('[INVITE JOIN] signOut failed',e);}
    setPendingConfirmation(null);
    setEmail('');
    setPass('');
  }

  // Fix 1 (build #6) — back-arrow on the "Check your email" interstitial used to call
  // handleDifferentEmail, which silently nuked pendingInviteJoin AND signed the user out.
  // That broke recovery via password sign-in (the email link gets pre-consumed by Gmail/Outlook
  // scanners, so users routinely fall back to password). New handler ONLY navigates: keeps
  // AsyncStorage state and the auth session intact so the drain can still fire later.
  async function handleBackFromConfirmation(){
    haptic('light');
    await diagLog('handleBackFromConfirmation (back-arrow) — preserving pendingInviteJoin + session');
    setPendingConfirmation(null);
  }

  var codeChars=String(code||'').toUpperCase().padEnd(6,' ').slice(0,6).split('');

  return(
    <View style={{flex:1,paddingTop:ins.top,backgroundColor:theme.bg}}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg}/>
      <NavBar
        title={pendingConfirmation?'Check your email':'Join your family'}
        leading={<TouchableOpacity onPress={pendingConfirmation?handleBackFromConfirmation:(step===1?onBack:function(){setStep(1);setPreview(null);})} style={{width:32,height:32,borderRadius:9999,backgroundColor:theme.surfaceElevated,alignItems:'center',justifyContent:'center'}}>
          <Text style={{fontFamily:FF.sansSemi,fontSize:18,fontWeight:'600',color:theme.text}}>←</Text>
        </TouchableOpacity>}
      />
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView contentContainerStyle={{padding:20,paddingBottom:40}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {pendingConfirmation&&<View>
            <Caps color={theme.primary}>Wellthy Fam</Caps>
            <Text style={{fontFamily:FF.serifItalic,fontSize:40,letterSpacing:-1.2,color:theme.text,marginTop:12,lineHeight:42}}>
              Check your{'\n'}email.
            </Text>
            <Text style={{fontFamily:FF.sans,fontSize:15,color:theme.textSecondary,marginTop:18,lineHeight:23}}>
              We sent a confirmation link to{' '}
              <Text style={{fontFamily:FF.sansSemi,color:theme.text}}>{pendingConfirmation.email}</Text>.
              Tap the link to finish joining{pendingConfirmation.familyName?' '+pendingConfirmation.familyName:' your family'}.
            </Text>
            <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted,marginTop:24,lineHeight:18}}>
              The email comes from Wellthy Fam {'<'}onboarding@resend.dev{'>'}. Check your spam folder if you don't see it within a minute.
            </Text>
            <View style={{height:32}}/>
            <SecondaryButton full disabled={resending} onPress={handleResend}>
              {resending?'Sending…':'Resend email'}
            </SecondaryButton>
            <TouchableOpacity onPress={handleDifferentEmail} style={{marginTop:18,alignItems:'center',paddingVertical:8}}>
              <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.primary}}>
                Use a different email
              </Text>
            </TouchableOpacity>
            {/* Diagnostics (build #5) — share the just-captured trace immediately */}
            <TouchableOpacity onPress={function(){haptic('light');shareDiagLogs();}} style={{marginTop:6,alignItems:'center',paddingVertical:6}}>
              <Text style={{fontFamily:FF.sans,fontSize:11,color:theme.muted}}>Send debug logs</Text>
            </TouchableOpacity>
          </View>}
          {!pendingConfirmation&&step===1&&<View>
            <Caps>Step 1 of 2</Caps>
            <Text style={{fontFamily:FF.serif,fontSize:28,letterSpacing:-0.8,color:theme.text,marginTop:8,lineHeight:32}}>Enter your invite code</Text>

            <View style={{flexDirection:'row',gap:8,marginTop:20,marginBottom:24}}>
              {codeChars.map(function(ch,i){
                var filled=ch&&ch!==' ';
                return <View key={'cbox_'+i} style={{
                  flex:1,height:56,borderRadius:12,
                  borderWidth:1.5,borderColor:filled?theme.primary:theme.border,
                  backgroundColor:theme.surface,
                  alignItems:'center',justifyContent:'center',
                }}>
                  <Text style={{fontFamily:FF.sansBold,fontSize:22,fontWeight:'700',color:theme.text}}>{filled?ch:''}</Text>
                </View>;
              })}
            </View>

            <TextInput
              style={{height:48,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,borderRadius:12,paddingHorizontal:16,fontFamily:FF.sansSemi,fontSize:18,fontWeight:'600',color:theme.text,backgroundColor:theme.surface,letterSpacing:4,textAlign:'center',marginBottom:20}}
              placeholder="ENTER CODE" placeholderTextColor={theme.muted}
              value={code}
              onChangeText={function(v){setCode(String(v||'').toUpperCase().slice(0,6));}}
              autoCapitalize="characters" autoCorrect={false} maxLength={6}
            />

            <PrimaryButton full disabled={loading} onPress={function(){lookup();}}>
              {loading?'Looking up…':'Continue'}
            </PrimaryButton>
          </View>}

          {!pendingConfirmation&&step===2&&preview&&<View>
            <Caps>Step 2 of 2</Caps>
            <Text style={{fontFamily:FF.serif,fontSize:28,letterSpacing:-0.8,color:theme.text,marginTop:8,lineHeight:32}}>Almost there.</Text>
            <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,marginTop:8,lineHeight:21}}>Confirm and create your account to finish joining.</Text>

            <Block bg={theme.primaryLight} style={{marginTop:16}}>
              <Caps color={theme.primary}>You’re joining</Caps>
              <Text style={{fontFamily:FF.serif,fontSize:24,letterSpacing:-0.4,color:theme.text,marginTop:8}}>{preview.family&&preview.family.family_name?preview.family.family_name:'Family'}</Text>
              <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,marginTop:6}}>Invited as {preview.invite.invited_member_name||'Member'} · {preview.invite.invited_member_role||'parent'}</Text>
            </Block>

            <Caps style={{marginTop:20,marginBottom:8}}>Email</Caps>
            <TextInput
              style={{height:48,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,borderRadius:12,paddingHorizontal:16,fontFamily:FF.sans,fontSize:15,color:theme.text,backgroundColor:theme.surface,marginBottom:16}}
              placeholder="you@email.com" placeholderTextColor={theme.muted}
              value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />

            <Caps style={{marginBottom:8}}>Password</Caps>
            <TextInput
              style={{height:48,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,borderRadius:12,paddingHorizontal:16,fontFamily:FF.sans,fontSize:15,color:theme.text,backgroundColor:theme.surface,marginBottom:24}}
              placeholder="Min 6 characters" placeholderTextColor={theme.muted}
              value={pass} onChangeText={setPass} secureTextEntry
            />

            <PrimaryButton full disabled={loading} onPress={joinAndLink}>
              {loading?'Joining…':'Join '+(preview.family&&preview.family.family_name?preview.family.family_name:'family')}
            </PrimaryButton>
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
    q18_height_ft:'',
    q18_height_in:'',
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
  var theme=useThemeColors();
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
      <Text style={[z.cap,{color:theme.muted}]}>{leftLabel||min}</Text>
      <Text style={[z.cap,{color:theme.muted}]}>{rightLabel||max}</Text>
    </View>
  </View>;
}

function ConditionalInput({show,children}){return show?<View style={{marginTop:10}}>{children}</View>:null;}

function NavigationButtons({canGoBack,canContinue,onBack,onContinue,isLast,saving}){
  var theme=useThemeColors();
  return <View style={[z.row,{marginTop:14,gap:10}]}> 
    <View style={{flex:1}}><SecondaryButton full disabled={!canGoBack||saving} onPress={onBack}>Back</SecondaryButton></View>
    <View style={{flex:1}}><PrimaryButton full disabled={!canContinue||saving} onPress={onContinue}>{saving?'Saving…':(isLast?'Finish':'Continue')}</PrimaryButton></View>
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
  // Track whether this user is joining via invite (user_type==='member') so we can skip
  // family-level questions that the family creator already answered (q6_family, q6_children_count, etc.).
  var[userType,setUserType]=useState('primary');
  var isInvitee=userType==='member';

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
        DB_COLUMNS.USERS.USER_TYPE,
      ].join(',');
      var{data:userDoc}=await supabase.from('users').select(questionnairePrefillColumns).eq('id',userId).maybeSingle();
      var merged=Object.assign({},defaults,userDoc&&userDoc[DB_COLUMNS.USERS.QUESTIONNAIRE_DATA]?userDoc[DB_COLUMNS.USERS.QUESTIONNAIRE_DATA]:{},progress&&progress.answers?progress.answers:{});
      if(userDoc){
        if(userDoc[DB_COLUMNS.USERS.USER_TYPE])setUserType(userDoc[DB_COLUMNS.USERS.USER_TYPE]);
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
      // Family composition (q6) is family-level — only the creator answers it. Invitees inherit from the family.
      if(!isInvitee){
        reqMulti('q6_family');
        if((answers.q6_family||[]).includes('Kids'))reqNumber('q6_children_count',1,10,'Please enter number of children (1-10).');
      }
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
      // Height: validate based on unit
      if(answers.q18_height_unit==='ft'){
        var ft=parseNumericAnswer(answers.q18_height_ft);
        var inch=parseNumericAnswer(answers.q18_height_in);
        if(ft===null)errs.q18_height='Please enter feet.';
        else if(ft<2 || ft>8)errs.q18_height='Feet must be 2-8.';
        else if(inch!==null && (inch<0 || inch>11))errs.q18_height='Inches must be 0-11.';
      }else{
        reqNumber('q18_height',50,260,'Please enter valid height in cm (50-260).');
      }
      // Weight: validate based on unit
      if(answers.q19_weight_unit==='lbs'){
        reqNumber('q19_weight',44,660,'Please enter valid weight in lbs (44-660).');
      }else{
        reqNumber('q19_weight',20,300,'Please enter valid weight in kg (20-300).');
      }
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
      height:(function(){
        if(qAnswers.q18_height_unit==='ft'){
          var ft=parseNumericAnswer(qAnswers.q18_height_ft);
          var inch=parseNumericAnswer(qAnswers.q18_height_in)||0;
          if(ft===null)return null;
          return Math.round((ft*30.48 + inch*2.54)*10)/10;
        }
        return qAnswers.q18_height?Number(qAnswers.q18_height):null;
      })(),
      weight:(function(){
        if(qAnswers.q19_weight_unit==='lbs'){
          var lbs=parseNumericAnswer(qAnswers.q19_weight);
          return lbs===null?null:Math.round(lbs*0.45359237*10)/10;
        }
        return qAnswers.q19_weight?Number(qAnswers.q19_weight):null;
      })(),
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
      <DateField value={qAnswers.q2_dob} onChange={function(d){setAnswer('q2_dob',d);}} minimumDate={new Date(1900,0,1)} maximumDate={new Date()} placeholder="Tap to select your date of birth" defaultPickerDate={new Date(1990,0,1)}/>
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

      {!isInvitee?<View>
        <QuestionText>6. Who do you have in your family?</QuestionText>
        <ChipSelector options={Q_FAMILY_OPTIONS} value={qAnswers.q6_family} onChange={function(v){setAnswer('q6_family',v);}} multi={true}/>
        {qErrors.q6_family?<Text style={z.errTx}>{qErrors.q6_family}</Text>:null}
        <ConditionalInput show={(qAnswers.q6_family||[]).includes('Kids')}>
          <Inp label="How many children?" value={String(qAnswers.q6_children_count||'')} onChangeText={function(v){setAnswer('q6_children_count',v.replace(/[^0-9]/g,''));}} keyboardType="numeric" placeholder="1-10"/>
          {qErrors.q6_children_count?<Text style={z.errTx}>{qErrors.q6_children_count}</Text>:null}
        </ConditionalInput>
      </View>:null}

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
      {qAnswers.q18_height_unit==='cm'
        ? <Inp value={String(qAnswers.q18_height||'')} onChangeText={function(v){setAnswer('q18_height',v.replace(/[^0-9.]/g,''));}} keyboardType="numeric" placeholder="e.g. 170"/>
        : <View style={[z.row,{gap:10}]}>
            <View style={{flex:1}}>
              <Inp label="Feet" value={String(qAnswers.q18_height_ft||'')} onChangeText={function(v){setAnswer('q18_height_ft',v.replace(/[^0-9]/g,''));}} keyboardType="numeric" placeholder="e.g. 5"/>
            </View>
            <View style={{flex:1}}>
              <Inp label="Inches" value={String(qAnswers.q18_height_in||'')} onChangeText={function(v){setAnswer('q18_height_in',v.replace(/[^0-9]/g,''));}} keyboardType="numeric" placeholder="0-11"/>
            </View>
          </View>}
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

  if(loading){return <View style={[z.qScr,z.cen,{backgroundColor:theme.bg}]}><ActivityIndicator size="large" color={theme.primary}/></View>;}

  if(showResumePrompt&&hasSavedProgress){
    return <View style={{flex:1,paddingTop:ins.top,backgroundColor:theme.bg,padding:20}}>
      <Caps color={theme.primary}>Welcome back</Caps>
      <Text style={{fontFamily:FF.serif,fontSize:30,letterSpacing:-0.8,color:theme.text,marginTop:8,lineHeight:34}}>Resume questionnaire</Text>
      <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,marginTop:10,lineHeight:21,marginBottom:20}}>We found your saved progress at page {qPage}. Continue where you left off, or start over.</Text>
      <PrimaryButton full onPress={function(){setShowResumePrompt(false);}}>Continue where I left off</PrimaryButton>
      <View style={{height:10}}/>
      <SecondaryButton full onPress={restartQuestionnaire}>Start from beginning</SecondaryButton>
    </View>;
  }

  var canContinue=isPageValid(qPage,qAnswers);
  var canExit=qPage>1||(isModal&&typeof onSkipped==='function');
  function onHeaderBack(){
    if(saving)return;
    if(qPage>1){handleBack();return;}
    if(isModal&&typeof onSkipped==='function'){onSkipped();}
  }
  var pageTitles=['About you','Money reality','Money outlook','Body basics','Health habits','Mind & screens','Purpose'];
  var pageTitle=pageTitles[qPage-1]||'';
  var pageProgressPct=Math.round((qPage/Q_TOTAL_PAGES)*100);

  return(<View style={{flex:1,paddingTop:ins.top,backgroundColor:theme.bg}}>
    <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg}/>
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={z.fl}>
      <View style={{paddingHorizontal:16,paddingTop:14,paddingBottom:14,backgroundColor:theme.bg,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:theme.border}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <TouchableOpacity
            onPress={onHeaderBack}
            disabled={!canExit||saving}
            accessibilityRole="button"
            accessibilityLabel={qPage>1?'Go back':'Close questionnaire'}
            style={{
              width:32,height:32,borderRadius:9999,
              backgroundColor:canExit?theme.surfaceElevated:'transparent',
              alignItems:'center',justifyContent:'center',
              opacity:canExit?1:0,
            }}
          >
            <Text style={{fontFamily:FF.sansSemi,fontSize:18,color:theme.text,fontWeight:'600'}}>{qPage>1?'←':'✕'}</Text>
          </TouchableOpacity>
          {isModal&&typeof onSkipped==='function'&&qPage>1?(
            <TouchableOpacity onPress={function(){if(!saving)onSkipped();}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Caps color={theme.textSecondary}>Skip for now</Caps>
            </TouchableOpacity>
          ):<View style={{width:32,height:32}}/>}
        </View>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
          <Caps>Page {qPage} of {Q_TOTAL_PAGES}</Caps>
          <Caps>{pageTitle}</Caps>
        </View>
        <Progress value={pageProgressPct}/>
      </View>
      <ScrollView style={z.fl} contentContainerStyle={{padding:20,paddingBottom:40}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {renderTransition()}
        {renderPageQuestions()}
        <View style={{flexDirection:'row',gap:10,marginTop:24}}>
          {qPage>1&&<View style={{flex:1}}><SecondaryButton full disabled={saving} onPress={handleBack}>Back</SecondaryButton></View>}
          <View style={{flex:qPage>1?1.4:1}}>
            <PrimaryButton full disabled={!canContinue||saving} onPress={handleContinue}>
              {saving?'Saving…':qPage===Q_TOTAL_PAGES?'Finish':'Continue'}
            </PrimaryButton>
          </View>
        </View>
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
    <View style={{flex:1,paddingTop:ins.top,backgroundColor:theme.bg}}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg}/>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView contentContainerStyle={{padding:20,paddingBottom:40}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {!createdFamilyId&&<View>
            <Caps color={theme.primary}>Final step</Caps>
            <Text style={{fontFamily:FF.serif,fontSize:36,letterSpacing:-1,color:theme.text,marginTop:10,lineHeight:38}}>Set up your family.</Text>
            <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,marginTop:10,lineHeight:21}}>You can add members later, or invite them now.</Text>

            <Caps style={{marginTop:24,marginBottom:8}}>Family name</Caps>
            <TextInput
              style={{height:48,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,borderRadius:12,paddingHorizontal:16,fontFamily:FF.sans,fontSize:15,color:theme.text,backgroundColor:theme.surface,marginBottom:24}}
              placeholder="The Sharma family" placeholderTextColor={theme.muted}
              value={familyName} onChangeText={setFamilyName}
            />

            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <Caps>Members</Caps>
              <Caps color={theme.muted}>Optional</Caps>
            </View>

            {(members||[]).map(function(m,i){
              var slot=SLOTS[i%5];
              return <Block key={m.localId||('member_'+i)} style={{marginBottom:10,padding:14}}>
                <View style={{flexDirection:'row',alignItems:'center',marginBottom:10}}>
                  <Avatar name={m.name||'?'} color={slot.bg} size={36}/>
                  <Caps style={{marginLeft:12,flex:1}}>Member {i+1}</Caps>
                  <TouchableOpacity onPress={function(){rm(i);}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                    <Caps color={theme.danger}>Remove</Caps>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={{height:44,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,borderRadius:10,paddingHorizontal:12,fontFamily:FF.sans,fontSize:15,color:theme.text,backgroundColor:theme.surface,marginBottom:10}}
                  placeholder="Name" placeholderTextColor={theme.muted}
                  value={m.name} onChangeText={function(v){upd(i,'name',v);}}
                />
                <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
                  {[{label:'Parent',value:'parent'},{label:'Child',value:'child'},{label:'Other',value:'other'}].map(function(opt){
                    var sel=m.role===opt.value;
                    return <TouchableOpacity key={'role_'+i+'_'+opt.value} style={[z.chip,sel&&z.chipSel]} onPress={function(){upd(i,'role',opt.value);}}>
                      <Text style={[z.chipTx,sel&&z.chipSelTx]}>{opt.label}</Text>
                    </TouchableOpacity>;
                  })}
                </View>
              </Block>;
            })}

            <TouchableOpacity onPress={addM} style={{
              backgroundColor:theme.surfaceElevated,
              borderWidth:1,borderStyle:'dashed',borderColor:theme.muted,
              borderRadius:16,paddingVertical:14,paddingHorizontal:16,
              alignItems:'flex-start',marginBottom:24,
            }}>
              <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.textSecondary}}>+ Add member</Text>
            </TouchableOpacity>

            <PrimaryButton full disabled={loading} onPress={create}>
              {loading?'Creating…':'Create family'}
            </PrimaryButton>
          </View>}

          {createdFamilyId&&<View>
            <Caps color={theme.primary}>You’re in</Caps>
            <Text style={{fontFamily:FF.serif,fontSize:36,letterSpacing:-1,color:theme.text,marginTop:10,lineHeight:38}}>Family created.</Text>
            <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,marginTop:10,marginBottom:24,lineHeight:21}}>Share these invite codes with your family members.</Text>

            {createdInvites.length===0&&<Block bg={theme.accentLight} style={{marginBottom:20,borderLeftWidth:3,borderLeftColor:theme.accent,borderRadius:16}}>
              <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.text,lineHeight:20}}>No invite codes yet. You can add and invite members later from Settings.</Text>
            </Block>}

            {createdInvites.map(function(inv){
              return <Block key={inv.id} style={{marginBottom:10,padding:16}}>
                <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.text}}>{inv.invited_member_name||'Member'}</Text>
                <Caps color={theme.textSecondary} style={{marginTop:2,marginBottom:12}}>{inv.invited_member_role||'parent'}</Caps>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                  <Text style={{fontFamily:FF.sansBold,fontSize:22,fontWeight:'700',color:theme.primary,letterSpacing:3}}>{inv.invite_code}</Text>
                  <TouchableOpacity onPress={function(){copyInviteText(inv);}}>
                    <Pill bg={theme.primaryLight} fg={theme.primary}>Share</Pill>
                  </TouchableOpacity>
                </View>
              </Block>;
            })}

            <View style={{height:8}}/>
            <PrimaryButton full onPress={function(){onDone&&onDone(createdFamilyId,normalizeText(familyName)||'My Family',createdInvites);}}>
              Continue to home
            </PrimaryButton>
          </View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════
function AddTxModal({visible,onClose,editTx,initialDate}){
  var theme=useThemeColors();
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
  return(<ModalSheet visible={visible} title={editTx?'Edit entry':'Add transaction'} onClose={onClose}>
    <View style={{flexDirection:'row',gap:8,marginBottom:16}}>
      <TouchableOpacity style={{flex:1,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:!isIncome?theme.primary:'transparent',borderWidth:!isIncome?0:1.5,borderColor:theme.border}} onPress={function(){setIsIncome(false);}}>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:13,color:!isIncome?'#fff':theme.textSecondary}}>Expense</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{flex:1,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:isIncome?theme.primary:'transparent',borderWidth:isIncome?0:1.5,borderColor:theme.border}} onPress={function(){setIsIncome(true);}}>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:13,color:isIncome?'#fff':theme.textSecondary}}>Income</Text>
      </TouchableOpacity>
    </View>

    <Caps style={{marginBottom:8}}>Amount</Caps>
    <View style={{backgroundColor:theme.primary,borderRadius:16,padding:18,marginBottom:16,flexDirection:'row',alignItems:'baseline'}}>
      <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:22,color:'#fff',opacity:0.85,marginRight:6}}>₹</Text>
      <TextInput
        value={amount} onChangeText={setAmount}
        placeholder="0" placeholderTextColor="rgba(255,255,255,0.5)"
        keyboardType="numeric"
        style={{flex:1,fontFamily:FF.sansBold,fontWeight:'700',fontSize:36,letterSpacing:-1,color:'#fff',padding:0}}
      />
    </View>

    <Inp label={isIncome?'Income source':'Merchant'} value={merchant} onChangeText={setMerchant} placeholder={isIncome?'Salary, freelance, rent...':'Swiggy, DMart...'} maxLength={LIMITS.finance.descMax}/>
    {!isIncome&&<SelectField label="Category" value={cat} onChange={setCat} options={categoryPickerOptions} placeholder="Select category"/>}

    <Caps style={{marginBottom:8}}>Who paid?</Caps>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16}}>
      <TouchableOpacity style={[z.chip,!mid&&z.chipSel]} onPress={function(){setMid('');}}><Text style={[z.chipTx,!mid&&z.chipSelTx]}>Joint</Text></TouchableOpacity>
      {members.map(function(m){return <TouchableOpacity key={m.id} style={[z.chip,mid===m.id&&z.chipSel]} onPress={function(){setMid(m.id);}}><Text style={[z.chipTx,mid===m.id&&z.chipSelTx]}>{m.name}</Text></TouchableOpacity>;})}
    </View>

    <DateField label="Date" value={selectedDate} onChange={setSelectedDate} maximumDate={new Date()}/>

    {!isIncome&&<View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
      <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.text}}>Family spending?</Text>
      <Switch value={isFamilySpending} onValueChange={setIsFamilySpending} trackColor={{true:theme.primary,false:theme.border}} thumbColor="#fff"/>
    </View>}

    <TouchableOpacity onPress={pickImage} style={{alignSelf:'flex-start',marginBottom:10}}>
      <Pill bg={theme.surfaceElevated} fg={theme.textSecondary}>📷 Add photo</Pill>
    </TouchableOpacity>
    {photoUri?<Image source={{uri:photoUri}} style={[z.photoPreview,{borderRadius:12,marginBottom:10}]}/>:null}

    <TouchableOpacity style={{flexDirection:'row',alignItems:'center',marginBottom:12}} onPress={function(){setIsRecurring(!isRecurring);}}>
      <View style={{
        width:18,height:18,borderRadius:6,marginRight:10,
        backgroundColor:isRecurring?theme.primary:'transparent',
        borderWidth:1.5,borderColor:isRecurring?theme.primary:theme.muted,
        alignItems:'center',justifyContent:'center',
      }}>{isRecurring&&<Text style={{color:'#fff',fontSize:11,fontWeight:'700'}}>✓</Text>}</View>
      <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.text}}>Mark as recurring transaction</Text>
    </TouchableOpacity>

    {isRecurring&&<Block style={{padding:14,marginBottom:12}}>
      <Caps style={{marginBottom:8}}>Frequency</Caps>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:10}}>
        {['monthly','weekly','biweekly'].map(function(f){var sel=recurringFreq===f;return <TouchableOpacity key={f} style={[z.chip,sel&&z.chipSel]} onPress={function(){setRecurringFreq(f);}}><Text style={[z.chipTx,sel&&z.chipSelTx]}>{f}</Text></TouchableOpacity>;})}
      </View>
      {recurringFreq==='monthly'&&<Inp label="Due day (1-31)" value={dueDay} onChangeText={setDueDay} keyboardType="numeric" placeholder="1"/>}
    </Block>}

    <View style={{flexDirection:'row',gap:10,marginTop:8}}>
      <View style={{flex:1}}><SecondaryButton full onPress={onClose}>Cancel</SecondaryButton></View>
      <View style={{flex:1.4}}><PrimaryButton full disabled={loading} onPress={save}>{loading?'Saving…':editTx?'Update':'Save transaction'}</PrimaryButton></View>
    </View>
  </ModalSheet>);
}

// ── QUICK LOG SHEET — sub-5-second transaction entry. Lives alongside AddTxModal.
// AddTxModal stays the canonical full-entry path (description, recurring, dates, photo, member).
// QuickLog is the in-the-moment path: amount → category → save. No description, no recurring,
// no member picker (defaults to 'joint'). Today's date only. Matches AddTxModal's insert payload
// exactly minus the merchant/description text, so existing income filters (category==='Income'),
// activity feed, scoring, and local upsert all keep working unchanged.
function QuickLogSheet({visible,onClose}){
  var theme=useThemeColors();
  var{familyId,userId,members,refreshTransactions,upsertTransactionLocal,logActivity,currentUserName}=useApp();
  var[amount,setAmount]=useState('');
  var[cat,setCat]=useState('');
  var[isIncome,setIsIncome]=useState(false);
  var[note,setNote]=useState('');
  var[saving,setSaving]=useState(false);

  var QL_CATS=[
    {key:'Daily Essentials',icon:'🛒'},
    {key:'House Bills',     icon:'🏠'},
    {key:'Travel',          icon:'✈️'},
    {key:'Health',          icon:'❤️'},
    {key:'Lifestyle',       icon:'🛍️'},
    {key:'Savings',         icon:'💰'},
    {key:'Cash',            icon:'💵'},
    {key:'Transfer',        icon:'🔁'},
  ];

  useEffect(function(){
    if(visible){setAmount('');setCat('');setIsIncome(false);setNote('');setSaving(false);}
  },[visible]);

  useEffect(function(){
    if(!visible)return;
    var sub=BackHandler.addEventListener('hardwareBackPress',function(){onClose();return true;});
    return function(){sub.remove();};
  },[visible,onClose]);

  function appendDigit(d){
    if(amount.length>=7)return;
    var next=amount===''?d:amount+d;
    haptic('light');
    setAmount(next);
  }
  function backspace(){
    if(!amount)return;
    haptic('light');
    setAmount(amount.slice(0,-1));
  }

  var amountNum=parseInt(amount||'0',10);
  var canSave=amountNum>0 && !!cat && !saving;

  async function save(){
    if(!canSave)return;
    setSaving(true);
    haptic('medium');
    try{
      // Match AddTxModal: income transactions are encoded via category='Income' (not a separate
      // type column), because the rest of the app filters income with t.category==='Income'.
      var selectedCategory=isIncome?'Income':cat;
      // Quick Log attributes to the person tapping the FAB. Joint stays the AddTxModal path
      // for shared expenses. Falls back to joint only if the current user isn't a member row
      // (e.g. an admin who hasn't been added to family_members).
      var meMember=(members||[]).find(function(m){return m.userId===userId;});
      var memberId=meMember?meMember.id:'joint';
      var memberName=meMember?meMember.name:'Joint';
      var cleanNote=normalizeText(note);
      var payload={
        family_id:familyId,
        merchant:cleanNote,
        amount:amountNum,
        category:selectedCategory,
        member_id:memberId,
        member_name:memberName,
        confirmed:true,
        source:'Manual',
        date:isoDate(new Date()),
        is_family_spending:false,
        recurring_transaction_id:null,
        photo_path:null,
      };
      var insertRes=await supabase.from('transactions').insert(payload).select().single();
      if(insertRes.error&&String(insertRes.error.message||'').toLowerCase().includes('photo_path')){
        var fallbackInsert=Object.assign({},payload);delete fallbackInsert.photo_path;
        insertRes=await supabase.from('transactions').insert(fallbackInsert).select().single();
      }
      if(insertRes.error)throw insertRes.error;
      var savedRow=insertRes.data;
      upsertTransactionLocal(normTransactions([insertRes.data])[0]);
      if(!isIncome){await recordScore(familyId,memberId,'manual_tx',5);}
      haptic('success');
      if(refreshTransactions)await refreshTransactions();
      if(logActivity){
        await logActivity('transaction',{
          user_name:currentUserName||'Someone',
          action:'created',
          amount:amountNum,
          category:selectedCategory,
          merchant:cleanNote,
          transaction_type:isIncome?'income':'expense',
        },savedRow&&savedRow.id,familyId);
      }
      onClose();
    }catch(e){
      console.log('[QUICK LOG SAVE ERROR]',e);
      haptic('error');
      showFriendlyError('Could not save transaction',e);
    }finally{
      setSaving(false);
    }
  }

  function Key({label,onPress,disabled,bg,fg}){
    return <TouchableOpacity activeOpacity={0.6} disabled={disabled} onPress={onPress} style={{
      flex:1,height:56,borderRadius:12,
      alignItems:'center',justifyContent:'center',
      backgroundColor:bg||'transparent',
      opacity:disabled?0.5:1,
    }}>
      <Text style={{fontFamily:fontW(500),fontWeight:'500',fontSize:24,color:fg||theme.text}}>{label}</Text>
    </TouchableOpacity>;
  }

  return <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,backgroundColor:'rgba(0,0,0,0.4)',justifyContent:'flex-end'}}>
      <Pressable style={{flex:1,minHeight:80}} onPress={onClose} accessibilityLabel="Close quick log"/>
      <View style={{
        backgroundColor:theme.bg,
        borderTopLeftRadius:28,borderTopRightRadius:28,
        paddingHorizontal:20,paddingTop:8,paddingBottom:24,
      }}>
        <View style={{width:36,height:4,borderRadius:2,backgroundColor:theme.border,alignSelf:'center',marginTop:8,marginBottom:8}}/>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:20,color:theme.text}}>Quick log</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Cancel quick log">
            <Text style={{fontFamily:fontW(500),fontWeight:'500',fontSize:16,color:theme.primary}}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <Text style={{
          fontFamily:fontW(600),fontWeight:'600',fontSize:48,color:theme.text,
          textAlign:'center',marginTop:8,marginBottom:10,letterSpacing:-1,
        }}>{'₹'+(amount?Number(amount).toLocaleString('en-IN'):'0')}</Text>
        <TextInput
          value={note} onChangeText={setNote}
          placeholder="What was it? (optional)" placeholderTextColor={theme.muted}
          maxLength={LIMITS.finance.descMax}
          returnKeyType="done"
          style={{
            fontFamily:FF.sans,fontSize:14,color:theme.text,
            backgroundColor:theme.surface,
            borderWidth:1,borderColor:theme.border,
            borderRadius:12,paddingHorizontal:14,paddingVertical:10,
            marginBottom:14,
          }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:2,paddingVertical:2,gap:8}} style={{marginBottom:14}}>
          {QL_CATS.map(function(c){
            var sel=cat===c.key;
            return <TouchableOpacity key={c.key} activeOpacity={0.7} onPress={function(){haptic('light');setCat(sel?'':c.key);}} style={{
              width:100,height:80,borderRadius:12,
              borderWidth:sel?2:1,
              borderColor:sel?theme.primary:theme.border,
              backgroundColor:sel?theme.primaryLight:'transparent',
              alignItems:'center',justifyContent:'center',padding:6,
            }} accessibilityLabel={c.key} accessibilityState={{selected:sel}}>
              <Text style={{fontSize:24,marginBottom:4}}>{c.icon}</Text>
              <Text numberOfLines={1} style={{fontFamily:FF.sans,fontSize:12,color:theme.text,textAlign:'center'}}>{c.key}</Text>
            </TouchableOpacity>;
          })}
        </ScrollView>
        <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
          <TouchableOpacity activeOpacity={0.8} onPress={function(){haptic('light');setIsIncome(false);}} style={{
            flex:1,height:40,borderRadius:9999,
            alignItems:'center',justifyContent:'center',
            backgroundColor:!isIncome?theme.primary:'transparent',
            borderWidth:!isIncome?0:1,borderColor:theme.border,
          }}><Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:14,color:!isIncome?'#fff':theme.textSecondary}}>Expense</Text></TouchableOpacity>
          <TouchableOpacity activeOpacity={0.8} onPress={function(){haptic('light');setIsIncome(true);}} style={{
            flex:1,height:40,borderRadius:9999,
            alignItems:'center',justifyContent:'center',
            backgroundColor:isIncome?theme.primary:'transparent',
            borderWidth:isIncome?0:1,borderColor:theme.border,
          }}><Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:14,color:isIncome?'#fff':theme.textSecondary}}>Income</Text></TouchableOpacity>
        </View>
        {[['1','2','3'],['4','5','6'],['7','8','9'],['⌫','0','✓']].map(function(row,ri){
          return <View key={ri} style={{flexDirection:'row',gap:8,marginBottom:8}}>
            {row.map(function(k,ki){
              if(k==='⌫')return <Key key={ki} label="⌫" onPress={backspace}/>;
              if(k==='✓')return <Key key={ki} label="✓" disabled={!canSave} onPress={save} bg={theme.primary} fg="#fff"/>;
              return <Key key={ki} label={k} onPress={function(){appendDigit(k);}}/>;
            })}
          </View>;
        })}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 6 STATEMENT UPLOAD — Phase B (UI)
// Backend: parse-statement / finalize-statement-import / cleanup-expired-statements
// edge functions deployed; storage bucket bank-statements exists; statement_imports,
// statement_transactions, merchant_categories tables live; transactions has the four
// new statement-origin columns (statement_import_id, raw_narration, merchant_normalized,
// confidence_score) and source='Statement' for imported rows.
//
// Two modals + a small onboarding screen:
//   1. StatementUploadModal — picker + upload + parse (5 stages)
//   2. StatementReviewModal — confidence-grouped review screen with finalize
//   3. StatementUploadOnboardingPrompt — Step 5 in the primary-user onboarding flow
//
// KNOWN LIMITATION (v1): no de-duplication if the user uploads the same statement
// twice — duplicates surface in the review screen and the user can discard them
// manually. PDF formatting differs even between months for the same bank, making
// reliable dedupe genuinely hard. Revisit in v2.
// ─────────────────────────────────────────────────────────────────────────────

// 5MB-ish upper-bound on what we'll trust to parse. Storage bucket allows up to
// 10MB per Phase A; we let the bucket enforce that limit and message it on failure.
var STATEMENT_MAX_BYTES = 10 * 1024 * 1024;
var STATEMENT_PARSE_PHRASES = [
  'Uploading your statement…',
  'Reading the pages…',
  'Finding transactions…',
  'Categorizing…',
  'Almost there…',
];
var STATEMENT_CATEGORY_OPTIONS = ['Daily Essentials','House Bills','Travel','Health','Lifestyle','Savings','Income','Cash','Transfer'];

function StatementUploadModal({visible,onClose,onOpenReview}){
  var theme=useThemeColors();
  var{familyId,userId,currentUserName}=useApp();

  var[stage,setStage]=useState('intro'); // intro | password | parsing | success | error
  var[pickedFile,setPickedFile]=useState(null);
  var[pdfPassword,setPdfPassword]=useState('');
  var[passwordAttempts,setPasswordAttempts]=useState(0);
  var[statementImportId,setStatementImportId]=useState(null);
  var[parseSummary,setParseSummary]=useState(null);
  var[error,setError]=useState(null); // {reason, message}
  var[phraseIdx,setPhraseIdx]=useState(0);

  // Reset all transient state every time the modal opens. Don't reset on close —
  // the parent unmounts us anyway.
  useEffect(function(){
    if(visible){
      setStage('intro');setPickedFile(null);setPdfPassword('');setPasswordAttempts(0);
      setStatementImportId(null);setParseSummary(null);setError(null);setPhraseIdx(0);
    }
  },[visible]);

  // Rotate the parsing phrase every 4s while in 'parsing' stage. Don't pretend to
  // know progress — just cycle.
  useEffect(function(){
    if(stage!=='parsing')return;
    var t=setInterval(function(){setPhraseIdx(function(i){return (i+1)%STATEMENT_PARSE_PHRASES.length;});},4000);
    return function(){clearInterval(t);};
  },[stage]);

  // Android hardware back: dismiss when not actively parsing (parsing should
  // complete or error before bailing).
  useEffect(function(){
    if(!visible)return;
    var sub=BackHandler.addEventListener('hardwareBackPress',function(){
      if(stage==='parsing')return true; // swallow during parse
      onClose();
      return true;
    });
    return function(){sub.remove();};
  },[visible,stage,onClose]);

  async function pickPDF(){
    try{
      var result=await DocumentPicker.getDocumentAsync({
        type:'application/pdf',
        copyToCacheDirectory:true,
        multiple:false,
      });
      if(result.canceled){return;}
      var asset=(result.assets&&result.assets[0])||null;
      if(!asset){return;}
      // Validate size + mime up-front so we don't insert a row for a doomed upload.
      if(asset.size&&asset.size>STATEMENT_MAX_BYTES){
        Alert.alert('PDF too large','PDF too large (over 10MB). Try the most recent month\'s statement instead.');
        return;
      }
      var mt=asset.mimeType||asset.type;
      if(mt&&mt!=='application/pdf'){
        Alert.alert('Not a PDF','That doesn\'t look like a PDF. Try downloading the statement again from your bank\'s app.');
        return;
      }
      setPickedFile(asset);
      // Skip password stage on first attempt — only show it if parse-statement
      // returns wrong_password.
      runParse(asset,null);
    }catch(e){
      console.log('[STATEMENT PICK ERROR]',e);
      showFriendlyError('Could not pick a PDF',e);
    }
  }

  // The full upload + parse pipeline. Reused from the password retry path.
  async function runParse(file,passwordOrNull){
    if(!familyId||!userId){
      setError({reason:'no_session',message:'Could not find your account session. Try closing and reopening the app.'});
      setStage('error');
      return;
    }
    setStage('parsing');
    setPhraseIdx(0);
    setError(null);

    var importId=statementImportId;
    try{
      // Step 1 — create the statement_imports row if we don't have one yet.
      // On password retry we reuse the existing one (its status='failed' from the
      // wrong_password attempt; flip it back to 'parsing').
      if(!importId){
        var insertRes=await supabase.from('statement_imports').insert({
          family_id:familyId,
          user_id:userId,
          document_type:'bank_account', // tentative; parse-statement updates with the real type
          status:'parsing',
          source_file_path:null,
        }).select('id').single();
        if(insertRes.error)throw insertRes.error;
        importId=insertRes.data.id;
        setStatementImportId(importId);
      } else {
        // Reset back to 'parsing' for the retry — the previous attempt set 'failed'.
        await supabase.from('statement_imports').update({
          status:'parsing',failure_reason:null,
        }).eq('id',importId);
      }

      // Step 2 — read the picked file as ArrayBuffer (NOT Blob — Blob path uploads
      // 0 bytes on some Expo RN builds) and upload to bank-statements bucket.
      var storagePath=userId+'/'+importId+'.pdf';
      var fileResp;
      try{fileResp=await fetch(file.uri);}catch(fetchErr){
        await markRowFailed(importId,'upload_failed: '+(fetchErr&&fetchErr.message||'fetch failed'));
        setError({reason:'upload_failed',message:'Couldn\'t reach our servers. Check your connection and try again.'});
        setStage('error');
        return;
      }
      var arrayBuffer=await fileResp.arrayBuffer();
      var up=await supabase.storage.from('bank-statements').upload(storagePath,arrayBuffer,{
        contentType:'application/pdf',upsert:true, // upsert so password retry overwrites the prior upload
      });
      if(up.error){
        await markRowFailed(importId,'upload_failed: '+up.error.message);
        setError({reason:'upload_failed',message:'Couldn\'t reach our servers. Check your connection and try again.'});
        setStage('error');
        return;
      }
      await supabase.from('statement_imports').update({source_file_path:storagePath}).eq('id',importId);

      // Step 3 — call parse-statement with a 90s client-side AbortController (server
      // has 60s, give 30s buffer for network + cold-start).
      var ctrl=new AbortController();
      var timer=setTimeout(function(){ctrl.abort();},90_000);
      var resp;
      try{
        resp=await fetch(EDGE_PARSE_STATEMENT,{
          method:'POST',
          signal:ctrl.signal,
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+SUPABASE_ANON_KEY},
          body:JSON.stringify({
            statement_import_id:importId,
            user_id:userId,
            family_id:familyId,
            storage_path:storagePath,
            pdf_password:passwordOrNull||null,
          }),
        });
      }catch(netErr){
        clearTimeout(timer);
        var aborted=netErr&&netErr.name==='AbortError';
        await markRowFailed(importId,aborted?'timeout':('network: '+(netErr&&netErr.message||'unknown')));
        setError({reason:aborted?'timeout':'network',message:aborted
          ?'This statement has a lot of transactions and took too long to read. Try a single month at a time.'
          :'Couldn\'t reach our servers. Check your connection and try again.'});
        setStage('error');
        return;
      }
      clearTimeout(timer);
      var data=await resp.json().catch(function(){return null;});

      // Step 4 — branch on response.
      if(resp.ok&&data&&data.success){
        setParseSummary(data);
        haptic('success');
        setStage('success');
        return;
      }
      if(resp.status===422&&data&&data.reason==='wrong_password'){
        setPasswordAttempts(function(n){return n+1;});
        if(passwordAttempts>=3){
          // 4th failure (we've already incremented for prior attempts) — give up.
          setError({reason:'wrong_password',message:'We tried a few times. Check the password format in your bank\'s email — often DOB in DDMMYYYY or PAN digits.'});
          setStage('error');
          return;
        }
        setStage('password');
        return;
      }
      if(resp.status===422&&data){
        var msg='We had trouble reading this statement.';
        if(data.reason==='corrupted_pdf')msg='We couldn\'t read this PDF. Try downloading it fresh from your bank\'s app.';
        else if(data.reason==='not_a_statement')msg='This doesn\'t look like a bank or credit card statement. We see no transactions.';
        else if(data.reason==='unable_to_extract_text')msg='We had trouble reading this statement. It might be scanned (image-based). Try downloading the digital version from your bank\'s app.';
        else if(data.reason==='already_processed')msg='This statement was already imported. Pick a different one.';
        setError({reason:data.reason||'unknown',message:msg});
        setStage('error');
        return;
      }
      // 500 / unexpected
      await markRowFailed(importId,'edge_failed: '+(data&&data.detail||resp.status));
      setError({reason:'server',message:'Something went wrong on our side. Try again in a moment.'});
      setStage('error');
    }catch(e){
      console.log('[STATEMENT PARSE ERROR]',e);
      try{if(importId)await markRowFailed(importId,'exception: '+(e&&e.message||'unknown'));}catch(_){}
      setError({reason:'server',message:'Something went wrong on our side. Try again in a moment.'});
      setStage('error');
    }
  }

  async function markRowFailed(id,reason){
    try{
      await supabase.from('statement_imports').update({status:'failed',failure_reason:String(reason).slice(0,500)}).eq('id',id);
    }catch(e){console.log('[STATEMENT MARK FAILED ERROR]',e);}
  }

  function tryAnotherStatement(){
    setStage('intro');
    setPickedFile(null);
    setPdfPassword('');
    setPasswordAttempts(0);
    setStatementImportId(null); // a fresh statement gets its own row
    setParseSummary(null);
    setError(null);
  }

  function titleForStage(){
    if(stage==='password')return 'Statement is password-protected';
    if(stage==='parsing')return 'Reading your statement';
    if(stage==='success')return 'Statement read';
    if(stage==='error')return 'We hit a snag';
    return 'Catch up your last statement';
  }

  return <ModalSheet visible={visible} title={titleForStage()} onClose={stage==='parsing'?function(){}:onClose} scroll={stage!=='parsing'}>
    {stage==='intro'?<View>
      <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,lineHeight:20,marginBottom:16}}>Upload your bank or credit card PDF — we'll read it for you. Takes ~30 seconds.</Text>
      <View style={{marginBottom:18}}>
        <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,marginBottom:8,lineHeight:19}}>• We use it once and delete it within 24 hours.</Text>
        <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,marginBottom:8,lineHeight:19}}>• We'll show you everything we found — you confirm what's real.</Text>
        <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,lineHeight:19}}>• Works with most Indian banks and credit cards.</Text>
      </View>
      <View style={{marginBottom:10}}><PrimaryButton full onPress={pickPDF}>Pick PDF</PrimaryButton></View>
      <SecondaryButton full onPress={onClose}>Cancel</SecondaryButton>
    </View>:null}

    {stage==='password'?<View>
      <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,lineHeight:20,marginBottom:14}}>Most Indian banks lock their PDFs. Enter the password — we use it once and forget it.</Text>
      <TextInput
        value={pdfPassword} onChangeText={setPdfPassword}
        placeholder="PDF password" placeholderTextColor={theme.muted}
        secureTextEntry={true}
        autoCapitalize="none" autoCorrect={false}
        style={{
          fontFamily:FF.sans,fontSize:15,color:theme.text,
          backgroundColor:theme.surface,
          borderWidth:1,borderColor:theme.border,
          borderRadius:12,paddingHorizontal:14,paddingVertical:12,
          marginBottom:8,
        }}
      />
      <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.textSecondary,lineHeight:17,marginBottom:6}}>Often your DOB in DDMMYYYY format, or PAN digits. Check your bank's email for the exact format.</Text>
      {passwordAttempts>0?<Text style={{fontFamily:FF.sans,fontSize:12,color:theme.danger,marginBottom:6}}>That password didn't work.</Text>:null}
      <Text style={{fontFamily:FF.sans,fontSize:11,color:theme.muted,marginBottom:14}}>{Math.max(0,4-passwordAttempts)} attempt{Math.max(0,4-passwordAttempts)===1?'':'s'} left.</Text>
      <View style={{marginBottom:10}}><PrimaryButton full disabled={pdfPassword.trim().length<3} onPress={function(){if(pickedFile)runParse(pickedFile,pdfPassword.trim());}}>Unlock and parse</PrimaryButton></View>
      <SecondaryButton full onPress={onClose}>Cancel</SecondaryButton>
    </View>:null}

    {stage==='parsing'?<View style={{paddingVertical:32,alignItems:'center'}}>
      <ActivityIndicator size="large" color={theme.primary}/>
      <Text style={{fontFamily:fontW(500),fontSize:15,color:theme.text,marginTop:18,textAlign:'center'}}>{STATEMENT_PARSE_PHRASES[phraseIdx]}</Text>
      <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.muted,marginTop:8,textAlign:'center'}}>This usually takes 20–40 seconds.</Text>
    </View>:null}

    {stage==='success'&&parseSummary?<View>
      <View style={{alignItems:'center',marginBottom:20,marginTop:6}}>
        <View style={{width:64,height:64,borderRadius:32,backgroundColor:theme.primaryLight,alignItems:'center',justifyContent:'center',marginBottom:12}}>
          <Text style={{fontSize:32,color:theme.primary}}>✓</Text>
        </View>
        <Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:22,color:theme.text,textAlign:'center'}}>Found {parseSummary.transaction_count||0} transaction{(parseSummary.transaction_count||0)===1?'':'s'}</Text>
        <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,textAlign:'center',marginTop:6}}>{parseSummary.bank_name||'Your statement'}{parseSummary.period_start&&parseSummary.period_end?', '+parseSummary.period_start+' to '+parseSummary.period_end:''}</Text>
      </View>
      <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,lineHeight:20,marginBottom:18,textAlign:'center'}}>Take a moment to look through them — you control what gets added.</Text>
      <View style={{marginBottom:10}}><PrimaryButton full onPress={function(){onOpenReview&&onOpenReview(statementImportId);}}>Review them now</PrimaryButton></View>
      <SecondaryButton full onPress={onClose}>I'll do this later</SecondaryButton>
    </View>:null}

    {stage==='error'&&error?<View>
      <View style={{alignItems:'center',marginBottom:18,marginTop:4}}>
        <View style={{width:56,height:56,borderRadius:28,backgroundColor:theme.accentLight,alignItems:'center',justifyContent:'center',marginBottom:12}}>
          <Text style={{fontSize:28,color:theme.accent}}>!</Text>
        </View>
        <Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:18,color:theme.text,textAlign:'center'}}>{error.message}</Text>
      </View>
      <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,lineHeight:19,marginBottom:18,textAlign:'center'}}>Your statement has been deleted. Nothing was saved.</Text>
      <View style={{marginBottom:10}}><PrimaryButton full onPress={tryAnotherStatement}>Try another statement</PrimaryButton></View>
      <SecondaryButton full onPress={onClose}>Close</SecondaryButton>
    </View>:null}
  </ModalSheet>;
}

// ─────────────────────────────────────────────────────────────────────────────
// StatementReviewModal — confidence-grouped review screen
// Loads statement_transactions for a given statement_import_id, groups by category,
// and lets the user collapse/expand, repick categories, discard rows, and finalize.
// One activity feed entry per import (NOT per row — would flood the feed).
// ─────────────────────────────────────────────────────────────────────────────
function StatementReviewModal({visible,statementImportId,onClose,onImported}){
  var theme=useThemeColors();
  var ins=useSafeAreaInsets();
  var{familyId,userId,members,refreshTransactions,logActivity,currentUserName}=useApp();
  var[loading,setLoading]=useState(true);
  var[importRow,setImportRow]=useState(null);
  var[stagedTxs,setStagedTxs]=useState([]);
  var[actions,setActions]=useState({}); // {[id]: {action:'pending'|'confirmed'|'discarded', category_confirmed}}
  var[expandedCats,setExpandedCats]=useState({}); // {[category]: true}
  var[pickerForId,setPickerForId]=useState(null); // tx id whose category picker is open
  var[submitting,setSubmitting]=useState(false);
  var[toast,setToast]=useState('');

  // Load on open.
  useEffect(function(){
    if(!visible||!statementImportId){setLoading(true);setImportRow(null);setStagedTxs([]);setActions({});setExpandedCats({});return;}
    (async function(){
      setLoading(true);
      try{
        var imp=await supabase.from('statement_imports').select('id, document_type, bank_name, account_last4, period_start, period_end, total_credits, total_debits, parsed_transaction_count').eq('id',statementImportId).maybeSingle();
        if(imp.error)throw imp.error;
        setImportRow(imp.data||null);
        var st=await supabase.from('statement_transactions').select('id, raw_narration, parsed_date, amount, transaction_type, merchant_normalized, category_suggested, confidence_score').eq('statement_import_id',statementImportId).eq('user_action','pending').order('parsed_date',{ascending:true});
        if(st.error)throw st.error;
        var rows=st.data||[];
        setStagedTxs(rows);
        // Initial actions: every row pending, category_confirmed=category_suggested.
        var seed={};
        rows.forEach(function(r){
          seed[r.id]={action:'pending',category_confirmed:r.category_suggested||'Daily Essentials'};
        });
        setActions(seed);
        // Compute initial expanded state per category: Income always expanded, plus
        // any category that has a non-high-confidence row.
        var byCat={};
        rows.forEach(function(r){
          var c=r.category_suggested||'Daily Essentials';
          if(!byCat[c])byCat[c]={count:0,minConf:1};
          byCat[c].count++;
          var cs=Number(r.confidence_score||0);
          if(cs<byCat[c].minConf)byCat[c].minConf=cs;
        });
        var initExp={};
        Object.keys(byCat).forEach(function(c){
          if(c==='Income')initExp[c]=true;
          else if(byCat[c].minConf<0.85)initExp[c]=true;
        });
        setExpandedCats(initExp);
      }catch(e){
        console.log('[STATEMENT REVIEW LOAD ERROR]',e);
        showFriendlyError('Could not load review',e);
      }finally{setLoading(false);}
    })();
  },[visible,statementImportId]);

  // Android back closes the modal (not a confirm dialog — see Edge Case #6: abandoning
  // mid-review just discards local picks, nothing to "save").
  useEffect(function(){
    if(!visible)return;
    var sub=BackHandler.addEventListener('hardwareBackPress',function(){onClose();return true;});
    return function(){sub.remove();};
  },[visible,onClose]);

  // ── Action helpers ───────────────────────────────────────────────────────────
  function setRowAction(id,patch){
    setActions(function(prev){return Object.assign({},prev,{[id]:Object.assign({},prev[id]||{action:'pending',category_confirmed:'Daily Essentials'},patch)});});
  }
  function confirmAllInCategory(cat){
    setActions(function(prev){
      var next=Object.assign({},prev);
      stagedTxs.forEach(function(r){
        if((r.category_suggested||'Daily Essentials')===cat){
          var was=next[r.id]||{action:'pending',category_confirmed:r.category_suggested||'Daily Essentials'};
          // Don't override discarded rows — user explicitly skipped.
          if(was.action!=='discarded'){
            next[r.id]={action:'confirmed',category_confirmed:r.category_suggested||'Daily Essentials'};
          }
        }
      });
      return next;
    });
  }
  function confirmAllPending(){
    setActions(function(prev){
      var next=Object.assign({},prev);
      stagedTxs.forEach(function(r){
        var was=next[r.id]||{action:'pending',category_confirmed:r.category_suggested||'Daily Essentials'};
        if(was.action!=='discarded'){
          next[r.id]={action:'confirmed',category_confirmed:r.category_suggested||'Daily Essentials'};
        }
      });
      return next;
    });
    haptic('light');
  }
  function toggleDiscard(id){
    var was=actions[id];
    if(was&&was.action==='discarded'){
      // un-discard: revert to pending with original suggestion
      var orig=stagedTxs.find(function(r){return r.id===id;});
      setRowAction(id,{action:'pending',category_confirmed:(orig&&orig.category_suggested)||'Daily Essentials'});
    } else {
      setRowAction(id,{action:'discarded'});
    }
    haptic('medium');
  }
  function pickCategory(id,category){
    setRowAction(id,{action:'confirmed',category_confirmed:category});
    setPickerForId(null);
    haptic('light');
  }

  // Group + sort for render. Income first, then expense categories by total amount desc.
  var grouped=(function(){
    var byCat={};
    stagedTxs.forEach(function(r){
      var c=r.category_suggested||'Daily Essentials';
      if(!byCat[c])byCat[c]={category:c,rows:[],total:0,minConf:1,sumConf:0};
      byCat[c].rows.push(r);
      byCat[c].total+=Number(r.amount||0);
      var cs=Number(r.confidence_score||0);
      if(cs<byCat[c].minConf)byCat[c].minConf=cs;
      byCat[c].sumConf+=cs;
    });
    var arr=Object.keys(byCat).map(function(k){var g=byCat[k];g.avgConf=g.sumConf/Math.max(g.rows.length,1);return g;});
    arr.sort(function(a,b){
      if(a.category==='Income'&&b.category!=='Income')return -1;
      if(b.category==='Income'&&a.category!=='Income')return 1;
      return b.total-a.total;
    });
    return arr;
  })();

  var confirmedCount=Object.keys(actions).reduce(function(n,id){return actions[id].action==='confirmed'?n+1:n;},0);
  var discardedCount=Object.keys(actions).reduce(function(n,id){return actions[id].action==='discarded'?n+1:n;},0);
  var pendingCount=stagedTxs.length-confirmedCount-discardedCount;
  var doneEnabled=(confirmedCount+discardedCount)>=1&&!submitting;

  async function onDone(){
    if(!doneEnabled)return;
    var meMember=(members||[]).find(function(m){return m.userId===userId;});
    if(!meMember){
      Alert.alert('Cannot finalize','Could not find your member record. Try reopening the app.');
      return;
    }
    setSubmitting(true);
    try{
      var confirmedPayload=[];
      var discardedIds=[];
      stagedTxs.forEach(function(r){
        var a=actions[r.id]||{action:'pending'};
        if(a.action==='confirmed'){
          confirmedPayload.push({statement_transaction_id:r.id,category_confirmed:a.category_confirmed});
        } else {
          // Pending and discarded both go in discarded — implicit-skip UX.
          discardedIds.push(r.id);
        }
      });
      var resp=await fetch(EDGE_FINALIZE_STATEMENT,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+SUPABASE_ANON_KEY},
        body:JSON.stringify({
          statement_import_id:statementImportId,
          user_id:userId,
          family_id:familyId,
          member_id:meMember.id,
          confirmed_transactions:confirmedPayload,
          discarded_transaction_ids:discardedIds,
        }),
      });
      var data=await resp.json().catch(function(){return null;});
      if(!resp.ok||!data||!data.success){
        haptic('error');
        showFriendlyError('Could not import',new Error((data&&data.detail)||('status '+resp.status)));
        setSubmitting(false);
        return;
      }
      haptic('success');
      // One activity feed entry for the whole import.
      if(logActivity){
        try{
          await logActivity('statement_import',{
            user_name:currentUserName||'Someone',
            bank_name:(importRow&&importRow.bank_name)||'',
            imported_count:Number(data.imported_count||0),
          },statementImportId,familyId);
        }catch(e){console.log('[STATEMENT ACTIVITY LOG ERROR]',e);}
      }
      try{await refreshTransactions();}catch(e){}
      // Toast (3s) — the success feedback. No alert.
      var override=Number(data.merchant_category_overrides_saved||0);
      var msg='Imported '+Number(data.imported_count||0)+' transaction'+(Number(data.imported_count||0)===1?'':'s')+'.';
      if(override>0)msg+=" We'll remember your category picks for next time.";
      setToast(msg);
      setTimeout(function(){
        setToast('');
        setSubmitting(false);
        onImported&&onImported({imported_count:data.imported_count});
        onClose();
      },1800);
    }catch(e){
      console.log('[STATEMENT FINALIZE ERROR]',e);
      haptic('error');
      showFriendlyError('Could not import',e);
      setSubmitting(false);
    }
  }

  if(!visible)return null;
  return <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={{flex:1,backgroundColor:theme.bg,paddingTop:ins.top}}>
      {/* Sticky header — paddingTop:ins.top above keeps it clear of the status bar
          (was hardcoded 24 on Android, which is too short on phones with notches/punch
          holes — caused the Done text to sit under the OS chrome and absorb taps,
          which presented as the "Done button does nothing" bug). */}
      <View style={{paddingTop:8,paddingBottom:12,paddingHorizontal:16,backgroundColor:theme.bg,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:theme.border}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <TouchableOpacity onPress={onClose} disabled={submitting}><Text style={{fontFamily:fontW(500),fontSize:16,color:theme.primary}}>Cancel</Text></TouchableOpacity>
          <View style={{flex:1,alignItems:'center'}}>
            <Text numberOfLines={1} style={{fontFamily:fontW(600),fontWeight:'600',fontSize:15,color:theme.text}}>
              {stagedTxs.length} transaction{stagedTxs.length===1?'':'s'}{importRow&&importRow.period_start&&importRow.period_end?', '+shortDate(importRow.period_start)+' – '+shortDate(importRow.period_end):''}
            </Text>
          </View>
          <TouchableOpacity onPress={onDone} disabled={!doneEnabled} style={{opacity:doneEnabled?1:0.4}}><Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:16,color:theme.primary}}>{submitting?'…':'Done'}</Text></TouchableOpacity>
        </View>
        {importRow?<Text numberOfLines={1} style={{fontFamily:FF.sans,fontSize:12,color:theme.textSecondary,textAlign:'center'}}>{(importRow.bank_name||'Statement')+' · '+(importRow.document_type==='credit_card'?'Credit card':'Bank account')+' · ending in '+(importRow.account_last4||'—')}</Text>:null}
        <Text style={{fontFamily:FF.sans,fontSize:11,color:theme.muted,textAlign:'center',marginTop:4}}>{confirmedCount} to import · {pendingCount+discardedCount} skipped</Text>
      </View>

      {/* Instructions */}
      <View style={{paddingHorizontal:16,paddingVertical:10,backgroundColor:theme.surfaceElevated}}>
        <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.textSecondary,lineHeight:17}}>Tap any group to look at the transactions inside. Tap any transaction to change its category. Long-press to discard.</Text>
      </View>

      {/* Body */}
      {loading?<View style={{padding:32,alignItems:'center'}}>
        <ActivityIndicator size="large" color={theme.primary}/>
        <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted,marginTop:14}}>Loading transactions…</Text>
      </View>:<ScrollView style={{flex:1}} contentContainerStyle={{padding:16,paddingBottom:32}}>
        {/* "Confirm everything as suggested" — power-user shortcut. Confirms every still-pending
            row using its category_suggested. Discarded rows are preserved (user explicitly skipped). */}
        {stagedTxs.length>0?<TouchableOpacity onPress={confirmAllPending} activeOpacity={0.7} style={{
          backgroundColor:theme.surface,borderRadius:12,padding:14,marginBottom:14,
          borderWidth:1,borderColor:theme.primaryLight,
        }}>
          <Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:14,color:theme.primary,textAlign:'center'}}>Confirm everything as suggested</Text>
          <Text style={{fontFamily:FF.sans,fontSize:11,color:theme.textSecondary,marginTop:4,textAlign:'center'}}>You can still edit any transaction afterward.</Text>
        </TouchableOpacity>:null}
        {grouped.length===0?<Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted,textAlign:'center',marginTop:32}}>No pending transactions in this import.</Text>:null}
        {grouped.map(function(g){
          var allHigh=g.minConf>=0.85;
          var isExpanded=!!expandedCats[g.category]||g.category==='Income';
          return <View key={'cat_'+g.category} style={{marginBottom:12}}>
            {/* Group header card */}
            <TouchableOpacity activeOpacity={0.85} onPress={function(){
              haptic('light');
              if(!isExpanded){
                // Tapping a collapsed group: expand AND auto-confirm every row in it
                // (regardless of confidence — was previously gated on allHigh, which
                // left medium/low-confidence groups stuck in 'pending' after a tap).
                setExpandedCats(function(prev){return Object.assign({},prev,{[g.category]:true});});
                confirmAllInCategory(g.category);
              } else {
                // Already expanded — tapping again just collapses. Does NOT un-confirm
                // rows (would be destructive — user has already reviewed them).
                setExpandedCats(function(prev){var next=Object.assign({},prev);delete next[g.category];return next;});
              }
            }} style={{
              backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,
              borderRadius:14,padding:14,
            }}>
              <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:10,flex:1}}>
                  <View style={{width:10,height:10,borderRadius:5,backgroundColor:(CAT_COLORS[g.category]||theme.primary)}}/>
                  <View style={{flex:1}}>
                    <Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:16,color:theme.text}}>{g.category}</Text>
                    <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,marginTop:2}}>{g.rows.length} transaction{g.rows.length===1?'':'s'} · ₹{fmt(Math.round(g.total))}</Text>
                  </View>
                </View>
                <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.primary}}>{isExpanded?'Hide':'Tap to review'}</Text>
              </View>
              {/* Confidence bar — only shown for collapsed all-high groups (not Income, which is always expanded) */}
              {!isExpanded&&allHigh?<View style={{marginTop:10}}>
                <View style={{height:4,borderRadius:2,backgroundColor:theme.surfaceElevated,overflow:'hidden'}}>
                  <View style={{width:Math.round(g.avgConf*100)+'%',height:'100%',backgroundColor:theme.primary}}/>
                </View>
                <Text style={{fontFamily:FF.sans,fontSize:9,color:theme.muted,marginTop:4,letterSpacing:0.4,textTransform:'uppercase'}}>Group looks accurate</Text>
              </View>:null}
            </TouchableOpacity>

            {/* Expanded rows */}
            {isExpanded?g.rows.map(function(r){
              var a=actions[r.id]||{action:'pending',category_confirmed:r.category_suggested||'Daily Essentials'};
              var cs=Number(r.confidence_score||0);
              var dotColor=cs>=0.85?theme.primary:(cs>=0.65?theme.accent:theme.danger);
              var isDiscarded=a.action==='discarded';
              return <Pressable
                key={r.id}
                onPress={function(){if(!isDiscarded){setPickerForId(r.id);}else{toggleDiscard(r.id);}}}
                onLongPress={function(){toggleDiscard(r.id);}}
                delayLongPress={350}
                style={{
                  flexDirection:'row',alignItems:'center',gap:10,
                  paddingVertical:12,paddingHorizontal:6,
                  borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:theme.border,
                  opacity:isDiscarded?0.45:1,
                }}
              >
                <View style={{width:10,height:10,borderRadius:5,backgroundColor:dotColor}}/>
                <View style={{flex:1,minWidth:0}}>
                  <Text numberOfLines={1} style={{fontFamily:fontW(500),fontSize:15,color:theme.text,textDecorationLine:isDiscarded?'line-through':'none'}}>{(r.merchant_normalized||(r.raw_narration||'').slice(0,30)||'(unknown)')}</Text>
                  <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,marginTop:2}}>{r.parsed_date?shortDate(r.parsed_date):'—'} · ₹{fmt(Number(r.amount||0))}{r.transaction_type==='credit'?' · credit':''}</Text>
                </View>
                <View style={{
                  paddingHorizontal:10,paddingVertical:6,borderRadius:9999,
                  backgroundColor:a.action==='confirmed'?theme.primaryLight:theme.surfaceElevated,
                  borderWidth:0,
                }}>
                  <Text style={{fontFamily:fontW(500),fontSize:12,color:a.action==='confirmed'?theme.primary:theme.textSecondary}}>{a.category_confirmed}</Text>
                </View>
              </Pressable>;
            }):null}
          </View>;
        })}
      </ScrollView>}

      {/* Category picker — small modal popping over the review */}
      <Modal visible={!!pickerForId} transparent animationType="fade" onRequestClose={function(){setPickerForId(null);}}>
        <Pressable onPress={function(){setPickerForId(null);}} style={{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'flex-end'}}>
          <Pressable onPress={function(e){e.stopPropagation&&e.stopPropagation();}} style={{
            backgroundColor:theme.bg,borderTopLeftRadius:24,borderTopRightRadius:24,
            paddingTop:18,paddingHorizontal:20,paddingBottom:24,
          }}>
            <Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:16,color:theme.text,marginBottom:14}}>Pick a category</Text>
            {STATEMENT_CATEGORY_OPTIONS.map(function(c){
              var sel=pickerForId&&actions[pickerForId]&&actions[pickerForId].category_confirmed===c;
              return <TouchableOpacity key={'pick_'+c} onPress={function(){pickCategory(pickerForId,c);}} style={{
                flexDirection:'row',alignItems:'center',justifyContent:'space-between',
                paddingVertical:12,paddingHorizontal:14,marginBottom:8,
                borderRadius:12,
                backgroundColor:sel?theme.primaryLight:theme.surface,
                borderWidth:1,borderColor:sel?theme.primary:theme.border,
              }}>
                <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                  <View style={{width:10,height:10,borderRadius:5,backgroundColor:CAT_COLORS[c]||theme.muted}}/>
                  <Text style={{fontFamily:fontW(500),fontSize:14,color:sel?theme.primary:theme.text}}>{c}</Text>
                </View>
                {sel?<Text style={{fontSize:14,color:theme.primary}}>✓</Text>:null}
              </TouchableOpacity>;
            })}
            <View style={{marginTop:6}}><SecondaryButton full onPress={function(){setPickerForId(null);}}>Cancel</SecondaryButton></View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Toast */}
      {toast?<View style={{position:'absolute',left:16,right:16,bottom:24,padding:14,borderRadius:14,backgroundColor:theme.primary}}>
        <Text style={{fontFamily:fontW(500),fontSize:14,color:'#fff',lineHeight:19}}>{toast}</Text>
      </View>:null}
    </View>
  </Modal>;
}

// Small date helper used by review modal — '5 Apr' style.
function shortDate(d){
  try{
    var dt=toDate(d);
    return dt.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  }catch(e){return String(d||'');}
}

// ─────────────────────────────────────────────────────────────────────────────
// StatementUploadOnboardingPrompt — Step 5 in the primary-user onboarding flow.
// Shown after FamilySetupScreen completes, before main_app. Member-tier users skip
// this entirely (they're joining an existing family — don't pile on more steps).
// ─────────────────────────────────────────────────────────────────────────────
function StatementUploadOnboardingPrompt({onUpload,onSkip}){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  return <View style={{flex:1,paddingTop:ins.top,backgroundColor:theme.bg}}>
    <ScrollView contentContainerStyle={{padding:24,paddingTop:48}}>
      <Caps color={theme.muted} style={{marginBottom:8}}>Step 5 of 5</Caps>
      <Text style={{fontFamily:FF.serif,fontSize:32,letterSpacing:-1,color:theme.text,lineHeight:36,marginBottom:6}}>One more thing before we start</Text>
      <Text style={{fontFamily:FF.sans,fontSize:15,color:theme.textSecondary,lineHeight:22,marginBottom:18}}>Want to skip a month of typing?</Text>
      <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.text,lineHeight:21,marginBottom:24}}>Most things you spend on already live in your bank or credit card statement. Upload a recent one and we'll fill in your last month — so the app reflects your real life from day one. (Optional. You can always do this later.)</Text>
      <View style={{marginBottom:12}}><PrimaryButton full onPress={onUpload}>Yes, upload a statement</PrimaryButton></View>
      <SecondaryButton full onPress={onSkip}>Skip for now</SecondaryButton>
      <Text style={{fontFamily:FF.sans,fontSize:11,color:theme.muted,marginTop:16,lineHeight:16,textAlign:'center'}}>We use your statement once and delete it within 24 hours.</Text>
    </ScrollView>
  </View>;
}

// StatementUploadOnboardingHost — wraps the onboarding prompt + the upload modal so
// "Yes, upload a statement" can open the modal in-place without leaving the onboarding
// screen. Closing the modal (success OR cancel) advances to main_app — review of any
// imported statement is resumable from the Finance tab via the persistent banner.
//
// WHY THIS HOST EXISTS (do not "clean up" by inlining into the screen branch or merging
// with StatementUploadOnboardingPrompt):
// AppContext.Provider only wraps the main_app branch in AppInner; pre-main screens
// (login, questionnaire, family_setup, this one) all take their data via props. But
// StatementUploadModal calls useApp() internally for familyId/userId/currentUserName,
// so the onboarding branch mounts a minimal 3-field AppContext.Provider just for this
// host to read from. The host owns the showUpload toggle so the prompt component stays
// stateless and reusable. If you refactor the modal to take props, this host can fold
// back into the screen branch — until then, the duplication is intentional.
function StatementUploadOnboardingHost({onDone}){
  var[showUpload,setShowUpload]=useState(false);
  return <>
    <StatementUploadOnboardingPrompt
      onUpload={function(){setShowUpload(true);}}
      onSkip={onDone}
    />
    <StatementUploadModal
      visible={showUpload}
      onClose={function(){setShowUpload(false);onDone();}}
      onOpenReview={function(){setShowUpload(false);onDone();}}
    />
  </>;
}

// ── PHASE 6: Vessel-based meal logging.
// Two-stage compose/review modal. Compose accepts free-text + meal time + (optional) member +
// photo + quick-pick chips. Tapping Continue calls parse-meal-log v7, which returns curated
// nutrition data per dish from food_vessels (or AI-estimated for unknowns). Review lets the
// user adjust quantity / unit per dish, toggle home-vs-restaurant cooking style, and save.
// On save: insert into meals (existing column shape + new vessel columns) → fire-and-forget
// update-portion-memory to remember this user's choices for next time.
//
// Photo is decoupled from nutrition (memory only). Old free-text edits fall back to compose
// stage with the original `items` text pre-populated since legacy meals have no dish_breakdown.
//
// VESSEL_GRAMS is the unit-to-grams map for when the user changes the unit away from the
// dish's default_vessel. For 'piece', dish-default vessel_grams wins; otherwise 30g fallback.
var VESSEL_GRAMS={katori:150,plate:300,glass:200,spoon:15};
var QUICK_QTY_OPTIONS=[0.5,1,1.5,2,3];
var ALLOWED_VESSELS=['katori','plate','piece','glass','spoon'];

function gramsForDish(dish,unit){
  if(unit===dish.default_vessel)return Number(dish.vessel_grams||0);
  if(unit==='piece')return dish.default_vessel==='piece'?Number(dish.vessel_grams||30):30;
  return VESSEL_GRAMS[unit]||Number(dish.vessel_grams||0);
}

// Compute per-dish macros given quantity + unit + cooking style. Returns rounded numbers.
function computeDishMacros(dish,state,cookingStyle){
  var unit=state.unit||dish.default_vessel;
  var qty=Number(state.quantity||0);
  var grams=gramsForDish(dish,unit)*qty;
  var protein=grams*Number(dish.protein_per_gram||0);
  var carbs=grams*Number(dish.carbs_per_gram||0);
  var fatBaseline=grams*Number(dish.fat_per_gram||0);
  var fat=cookingStyle==='restaurant'?fatBaseline*Number(dish.restaurant_fat_multiplier||1.30):fatBaseline;
  var calories=grams*Number(dish.calories_per_gram||0);
  if(cookingStyle==='restaurant'){
    // Restaurant fat lift adds ~9 kcal per gram of extra fat (Atwater).
    calories+=fatBaseline*(Number(dish.restaurant_fat_multiplier||1.30)-1)*9;
  }
  return{
    grams:Math.round(grams),
    protein:Math.round(protein*10)/10,
    carbs:Math.round(carbs*10)/10,
    fat:Math.round(fat*10)/10,
    calories:Math.round(calories),
  };
}

function AddMealModal({visible,onClose,editMeal,initialMealType,initialDate}){
  var theme=useThemeColors();
  var{familyId,members,userId,isAdmin,refreshMeals,upsertMealLocal,logActivity,currentUserName}=useApp();
  // ── Stage machine: 'compose' (typing) → 'review' (per-dish quantity/unit) → 'saving' ──
  var[mealStage,setMealStage]=useState('compose');
  var[mealTime,setMealTime]=useState(initialMealType||'lunch');
  var[itemsText,setItemsText]=useState('');
  var[mid,setMid]=useState(''); // member picker (preserved for co-admin/admin logging on behalf)
  var[selectedDate,setSelectedDate]=useState(initialDate?toDate(initialDate):new Date());
  var[parsedDishes,setParsedDishes]=useState([]);
  var[perDishState,setPerDishState]=useState({});
  var[cookingStyle,setCookingStyle]=useState('home'); // meal-level — applies to all dishes
  var[photoUri,setPhotoUri]=useState('');
  var[topDishes,setTopDishes]=useState([]);
  var[parsing,setParsing]=useState(false);
  var[parseError,setParseError]=useState('');
  var[unitPickerFor,setUnitPickerFor]=useState(null); // dish_normalized whose unit dropdown is open
  var mealTypes=LIMITS.meal.allowedTypes;
  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(function(){
    if(!visible)return;
    // Compute a sensible default meal time by hour-of-day if no explicit initial type was passed.
    function defaultByHour(){var h=new Date().getHours();if(h<11)return'breakfast';if(h<16)return'lunch';if(h<19)return'snack';return'dinner';}
    if(editMeal){
      setMealTime((editMeal.mealTime||'lunch').toLowerCase());
      setSelectedDate(toDate(editMeal.date));
      setMid(editMeal.memberId||'');
      setPhotoUri(editMeal.photo_url||editMeal.photo_path||'');
      // Edit-mode UX: pre-fill the original items text and stay in compose. The user taps
      // Continue to re-parse via the vessel pipeline. Legacy meals have no dish_breakdown,
      // and even meals that DO have one still need fresh per-gram macros from food_vessels
      // for the review-stage math, so re-parsing is the simplest correct path.
      setItemsText(editMeal.items||'');
    } else {
      setMealTime(initialMealType||defaultByHour());
      setSelectedDate(initialDate?toDate(initialDate):new Date());
      setMid('');
      setPhotoUri('');
      setItemsText('');
    }
    setMealStage('compose');
    setParsedDishes([]);
    setPerDishState({});
    setCookingStyle('home');
    setParseError('');
    setUnitPickerFor(null);
  },[visible,editMeal,initialMealType,initialDate]);

  // Load top-dish chips on open (silent on error — chips just don't show).
  useEffect(function(){
    if(!visible||!userId)return;
    (async function(){
      try{
        var r=await supabase.rpc('get_user_top_dishes',{p_user_id:userId,p_limit:4});
        if(r&&!r.error&&Array.isArray(r.data))setTopDishes(r.data);
        else setTopDishes([]);
      }catch(e){setTopDishes([]);}
    })();
  },[visible,userId]);

  useEffect(function(){
    (async function(){
      try{
        await ImagePicker.requestCameraPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }catch(e){console.log('[MEAL PHOTO PERMISSION ERROR]',e);}
    })();
  },[]);

  // Android hardware back: act like Cancel based on stage.
  useEffect(function(){
    if(!visible)return;
    var sub=BackHandler.addEventListener('hardwareBackPress',function(){handleCancel();return true;});
    return function(){sub.remove();};
  },[visible,mealStage]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function pickImage(){
    Alert.alert('Add photo','Choose source',[
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

  // Parse free-text via the vessel pipeline edge function and advance to review.
  // Caller passes the text directly so we don't depend on state-batching from quick-chip taps.
  async function parseAndAdvance(text){
    var clean=normalizeText(text);
    if(!clean){Alert.alert('Validation error','Please describe what you ate.');return;}
    if(clean.length>LIMITS.meal.descMax){Alert.alert('Validation error','Meal description must be '+LIMITS.meal.descMax+' characters or less.');return;}
    setParsing(true);setParseError('');
    try{
      var resp=await fetch(EDGE_MEAL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SUPABASE_ANON_KEY},body:JSON.stringify({items_text:clean,user_id:userId})});
      var data=await resp.json().catch(function(){return null;});
      if(resp.status===422){
        setParseError("We couldn't understand that. Try simpler descriptions, like '2 rotis, dal, sabzi'.");
        return;
      }
      if(!resp.ok||!data||!Array.isArray(data.dishes)||data.dishes.length===0){
        showFriendlyError('Could not parse meal',new Error((data&&data.detail)||'parse error'));
        return;
      }
      // Seed perDishState from the response. user_default_* fields drive defaults when present.
      var seed={};
      data.dishes.forEach(function(d){
        seed[d.dish_normalized]={
          quantity:d.user_default_quantity!=null?Number(d.user_default_quantity):1,
          unit:d.user_default_unit||d.default_vessel,
          isUserDefault:d.user_default_quantity!=null,
        };
      });
      setParsedDishes(data.dishes);
      setPerDishState(seed);
      // Cooking style: if any dish has a remembered style, use the most common; else 'home'.
      var stylesCount={home:0,restaurant:0};
      data.dishes.forEach(function(d){if(d.user_default_cooking_style)stylesCount[d.user_default_cooking_style]++;});
      var initialStyle=stylesCount.restaurant>stylesCount.home?'restaurant':'home';
      setCookingStyle(initialStyle);
      setMealStage('review');
      setItemsText(clean);
      haptic('light');
    }catch(e){
      console.log('[MEAL PARSE ERROR]',e);
      showFriendlyError('Could not reach meal parser',e);
    }finally{
      setParsing(false);
    }
  }

  function handleQuickPickChip(chip){
    haptic('light');
    setItemsText(chip.dish_name||chip.dish_normalized);
    parseAndAdvance(chip.dish_name||chip.dish_normalized);
  }

  function handleCancel(){
    if(mealStage==='review'){
      Alert.alert('Discard this meal?','Your dish edits won’t be saved.',[
        {text:'Cancel',style:'cancel'},
        {text:'Discard',style:'destructive',onPress:function(){resetAndClose();}},
      ]);
      return;
    }
    if(mealStage==='saving')return; // ignore while saving
    resetAndClose();
  }

  function resetAndClose(){
    setMealStage('compose');
    setItemsText('');
    setParsedDishes([]);
    setPerDishState({});
    setPhotoUri('');
    setMid('');
    setParseError('');
    setUnitPickerFor(null);
    onClose();
  }

  function changeQuantity(dishKey,delta){
    setPerDishState(function(prev){
      var cur=prev[dishKey]||{quantity:1,unit:'katori'};
      var next=Math.max(0,Math.round((Number(cur.quantity||0)+delta)*10)/10);
      return Object.assign({},prev,{[dishKey]:Object.assign({},cur,{quantity:next})});
    });
    haptic('light');
  }
  function setQuantityDirect(dishKey,qty){
    setPerDishState(function(prev){
      var cur=prev[dishKey]||{quantity:1,unit:'katori'};
      return Object.assign({},prev,{[dishKey]:Object.assign({},cur,{quantity:qty})});
    });
    haptic('light');
  }
  function changeUnit(dishKey,unit){
    setPerDishState(function(prev){
      var cur=prev[dishKey]||{quantity:1,unit:'katori'};
      return Object.assign({},prev,{[dishKey]:Object.assign({},cur,{unit:unit})});
    });
    setUnitPickerFor(null);
    haptic('light');
  }

  // Total nutrition across all dishes — used both for display and the meals row payload.
  function computeMealTotals(){
    var totals={protein:0,carbs:0,fat:0,calories:0};
    parsedDishes.forEach(function(d){
      var m=computeDishMacros(d,perDishState[d.dish_normalized]||{quantity:1,unit:d.default_vessel},cookingStyle);
      totals.protein+=m.protein;totals.carbs+=m.carbs;totals.fat+=m.fat;totals.calories+=m.calories;
    });
    return{
      protein:Math.round(totals.protein*10)/10,
      carbs:Math.round(totals.carbs*10)/10,
      fat:Math.round(totals.fat*10)/10,
      calories:Math.round(totals.calories),
    };
  }

  // Save: insert/update meals row + fire-and-forget portion memory.
  async function handleSave(){
    if(!mealTypes.includes(mealTime)){Alert.alert('Validation error','Please select breakfast, lunch, snack, or dinner.');return;}
    if(isFutureDate(selectedDate)){Alert.alert('Validation error','Date cannot be in the future.');return;}
    if(mid&&!canModifyMemberData(isAdmin,members,userId,mid)){Alert.alert('Not allowed','You can only log your own meals.');return;}
    if(parsedDishes.length===0){Alert.alert('Validation error','No dishes to save.');return;}
    var anyZero=parsedDishes.some(function(d){return Number((perDishState[d.dish_normalized]||{}).quantity||0)<=0;});
    if(anyZero){Alert.alert('Validation error','Set a quantity above zero for every dish.');return;}

    setMealStage('saving');
    try{
      var mN=members.find(function(m){return m.id===mid;})||members[0];
      var totals=computeMealTotals();

      // Photo upload (decoupled from nutrition — memory only).
      var uploadedPhotoPath=photoUri;
      if(photoUri&&photoUri.indexOf('http')!==0){
        try{uploadedPhotoPath=await uploadPhotoToStorage('meal-photos',photoUri,userId,'meal');}
        catch(photoErr){console.log('[MEAL PHOTO UPLOAD ERROR]',photoErr);uploadedPhotoPath=null;}
      }

      // Build dish_breakdown for the meals.dish_breakdown jsonb column.
      var dishBreakdown=parsedDishes.map(function(d){
        var s=perDishState[d.dish_normalized]||{quantity:1,unit:d.default_vessel};
        var m=computeDishMacros(d,s,cookingStyle);
        return{
          dish_normalized:d.dish_normalized,
          dish_name:d.dish_name,
          quantity:Number(s.quantity),
          unit:s.unit,
          grams:m.grams,
          protein:m.protein,
          carbs:m.carbs,
          fat:m.fat,
          calories:m.calories,
          nutrition_source:d.nutrition_source,
        };
      });
      var allCurated=parsedDishes.every(function(d){return d.nutrition_source==='curated';});
      var nutritionSource=allCurated?'curated':'ai_estimate';

      var mealPayload={
        family_id:familyId,
        meal_time:mealTime.charAt(0).toUpperCase()+mealTime.slice(1),
        items:itemsText,
        protein:totals.protein,
        carbs:totals.carbs,
        fat:totals.fat,
        cal:totals.calories,
        member_id:mid||(mN&&mN.id)||'',
        member_name:mN?mN.name:'',
        date:isoDate(selectedDate),
        photo_path:uploadedPhotoPath||null,
        // New vessel columns:
        vessel_unit:null,           // reserved for v2 single-dish entries; multi-dish meals store the breakdown in dish_breakdown
        vessel_quantity:null,
        cooking_style:cookingStyle,
        nutrition_source:nutritionSource,
        dish_breakdown:dishBreakdown,
      };

      var savedRow;
      if(editMeal){
        var upd=await supabase.from('meals').update(mealPayload).eq('id',editMeal.id).select().single();
        if(upd.error)throw upd.error;
        savedRow=upd.data;
        upsertMealLocal(normMeals([upd.data])[0]);
      }else{
        var ins=await supabase.from('meals').insert(mealPayload).select().single();
        if(ins.error)throw ins.error;
        savedRow=ins.data;
        upsertMealLocal(normMeals([ins.data])[0]);
        var scoreMid=mealPayload.member_id||'joint';
        try{await recordScore(familyId,scoreMid,'meal_logged',15);}catch(e){}
        if(totals.protein>=50){try{await recordScore(familyId,scoreMid,'protein_hit',20);}catch(e){}}
        try{await bumpStreak(familyId,scoreMid,'meals');}catch(e){}
      }

      // Fire-and-forget portion memory update — failures must not block save.
      try{
        fetch(EDGE_UPDATE_PORTION,{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+SUPABASE_ANON_KEY},
          body:JSON.stringify({
            user_id:userId,
            dishes:parsedDishes.map(function(d){
              var s=perDishState[d.dish_normalized]||{quantity:1,unit:d.default_vessel};
              return{dish_normalized:d.dish_normalized,quantity:Number(s.quantity),unit:s.unit,cooking_style:cookingStyle};
            }),
          }),
        }).catch(function(e){console.log('[UPDATE PORTION ERROR]',e);});
      }catch(e){console.log('[UPDATE PORTION DISPATCH ERROR]',e);}

      // Activity feed (preserve existing pattern; payload shape unchanged).
      if(logActivity){
        try{
          await logActivity('meal',{
            user_name:currentUserName||'Someone',
            action:editMeal?'updated':'created',
            meal_time:mealPayload.meal_time,
            protein:mealPayload.protein,
            member_name:mN?mN.name:'',
            dish_count:parsedDishes.length,
          },savedRow&&savedRow.id||(editMeal&&editMeal.id)||null,familyId);
        }catch(e){console.log('[MEAL ACTIVITY LOG ERROR]',e);}
      }

      try{await refreshMeals();}catch(e){}
      haptic('success');
      resetAndClose();
    }catch(e){
      console.log('[MEAL SAVE ERROR]',e);
      haptic('error');
      showFriendlyError(editMeal?'Could not update meal':'Could not save meal',e);
      setMealStage('review'); // keep edits intact
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  function MealTimePills(){
    return <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
      {mealTypes.map(function(t){
        var sel=mealTime===t;
        return <TouchableOpacity key={t} activeOpacity={0.8} onPress={function(){haptic('light');setMealTime(t);}} style={{
          flex:1,height:38,borderRadius:9999,
          alignItems:'center',justifyContent:'center',
          backgroundColor:sel?theme.primary:'transparent',
          borderWidth:sel?0:1,borderColor:theme.border,
        }}><Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:13,color:sel?'#fff':theme.textSecondary}}>{t.charAt(0).toUpperCase()+t.slice(1)}</Text></TouchableOpacity>;
      })}
    </View>;
  }

  function MemberChips(){
    if(!members||members.length===0)return null;
    return <View>
      <Caps style={{marginBottom:8}}>Who?</Caps>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14}}>
        {members.map(function(m){return <TouchableOpacity key={m.id} style={[z.chip,mid===m.id&&z.chipSel]} onPress={function(){haptic('light');setMid(m.id);}}><Text style={[z.chipTx,mid===m.id&&z.chipSelTx]}>{m.name}</Text></TouchableOpacity>;})}
      </View>
    </View>;
  }

  function PhotoRow(){
    return <View style={{marginBottom:14}}>
      {!photoUri?<TouchableOpacity onPress={pickImage} style={{alignSelf:'flex-start'}}>
        <Pill bg={theme.surfaceElevated} fg={theme.textSecondary}>📷 Add photo (optional)</Pill>
      </TouchableOpacity>:<View style={{flexDirection:'row',alignItems:'center',gap:10}}>
        <Image source={{uri:photoUri}} style={{width:60,height:60,borderRadius:10}}/>
        <TouchableOpacity onPress={function(){haptic('light');setPhotoUri('');}} style={{paddingHorizontal:10,paddingVertical:6,borderRadius:9999,borderWidth:1,borderColor:theme.border}}>
          <Text style={{fontFamily:fontW(500),fontSize:13,color:theme.textSecondary}}>✕ Remove</Text>
        </TouchableOpacity>
      </View>}
    </View>;
  }

  function CookingStyleToggle(){
    return <View style={{marginBottom:14}}>
      <Caps style={{marginBottom:8}}>Cooking style</Caps>
      <View style={{flexDirection:'row',gap:8}}>
        {[['home','Home-cooked'],['restaurant','Restaurant']].map(function(pair){
          var val=pair[0];var sel=cookingStyle===val;
          return <TouchableOpacity key={val} activeOpacity={0.8} onPress={function(){haptic('light');setCookingStyle(val);}} style={{
            flex:1,height:38,borderRadius:9999,
            alignItems:'center',justifyContent:'center',
            backgroundColor:sel?theme.primary:'transparent',
            borderWidth:sel?0:1,borderColor:theme.border,
          }}><Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:13,color:sel?'#fff':theme.textSecondary}}>{pair[1]}</Text></TouchableOpacity>;
        })}
      </View>
    </View>;
  }

  function DishRow(props){
    var d=props.dish;
    var s=perDishState[d.dish_normalized]||{quantity:1,unit:d.default_vessel};
    var macros=computeDishMacros(d,s,cookingStyle);
    var unitOpen=unitPickerFor===d.dish_normalized;
    var unitGrams=gramsForDish(d,s.unit);
    return <View style={{paddingVertical:14,borderTopWidth:props.first?0:StyleSheet.hairlineWidth,borderTopColor:theme.border}}>
      {/* Dish name row */}
      <View style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',marginBottom:6}}>
        <View style={{flex:1,flexDirection:'row',alignItems:'baseline',flexWrap:'wrap',gap:6}}>
          <Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:16,color:theme.text}}>{d.dish_name}</Text>
          <Text style={{fontFamily:FF.sans,fontSize:11,color:theme.textSecondary}}>≈{Math.round(unitGrams)}g per {s.unit}</Text>
        </View>
        {s.isUserDefault?<Text style={{fontFamily:FF.sans,fontSize:10,color:theme.textSecondary}}>From last time</Text>:null}
        {d.nutrition_source==='ai_estimate'?<TouchableOpacity onPress={function(){Alert.alert('Estimated nutrition',"We don't have exact data for this dish yet — values are estimated.");}} style={{marginLeft:6}}>
          <Text style={{fontSize:13,color:theme.textSecondary}}>ⓘ</Text>
        </TouchableOpacity>:null}
      </View>
      {/* Unit picker (single pill that toggles a dropdown) */}
      <View style={{marginBottom:8}}>
        <TouchableOpacity activeOpacity={0.8} onPress={function(){haptic('light');setUnitPickerFor(unitOpen?null:d.dish_normalized);}} style={{
          alignSelf:'flex-start',height:32,paddingHorizontal:14,borderRadius:9999,
          alignItems:'center',justifyContent:'center',
          backgroundColor:theme.surfaceElevated,borderWidth:1,borderColor:theme.border,
        }}><Text style={{fontFamily:fontW(500),fontSize:13,color:theme.text}}>{s.unit} ▾</Text></TouchableOpacity>
        {unitOpen?<View style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:6}}>
          {ALLOWED_VESSELS.map(function(u){
            var sel=s.unit===u;
            return <TouchableOpacity key={u} onPress={function(){changeUnit(d.dish_normalized,u);}} style={{
              paddingHorizontal:12,height:30,borderRadius:9999,
              alignItems:'center',justifyContent:'center',
              backgroundColor:sel?theme.primary:'transparent',
              borderWidth:sel?0:1,borderColor:theme.border,
            }}><Text style={{fontFamily:fontW(500),fontSize:12,color:sel?'#fff':theme.textSecondary}}>{u}</Text></TouchableOpacity>;
          })}
        </View>:null}
      </View>
      {/* Quantity row */}
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:18,marginBottom:8}}>
        <TouchableOpacity onPress={function(){changeQuantity(d.dish_normalized,-0.5);}} style={{width:36,height:36,borderRadius:9999,alignItems:'center',justifyContent:'center',backgroundColor:theme.surfaceElevated,borderWidth:1,borderColor:theme.border}}>
          <Text style={{fontFamily:fontW(600),fontSize:18,color:theme.text}}>−</Text>
        </TouchableOpacity>
        <Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:28,color:theme.text,minWidth:54,textAlign:'center'}}>{Number(s.quantity).toString()}</Text>
        <TouchableOpacity onPress={function(){changeQuantity(d.dish_normalized,0.5);}} style={{width:36,height:36,borderRadius:9999,alignItems:'center',justifyContent:'center',backgroundColor:theme.surfaceElevated,borderWidth:1,borderColor:theme.border}}>
          <Text style={{fontFamily:fontW(600),fontSize:18,color:theme.text}}>+</Text>
        </TouchableOpacity>
      </View>
      {/* Quick-pick row */}
      <View style={{flexDirection:'row',gap:6,marginBottom:8,justifyContent:'center'}}>
        {QUICK_QTY_OPTIONS.map(function(q){
          var sel=Number(s.quantity)===q;
          var label=q===0.5?'½':q===1.5?'1½':String(q);
          return <TouchableOpacity key={q} onPress={function(){setQuantityDirect(d.dish_normalized,q);}} style={{
            paddingHorizontal:12,height:30,borderRadius:9999,
            alignItems:'center',justifyContent:'center',
            backgroundColor:sel?theme.primary:theme.primaryLight,
            borderWidth:0,
          }}><Text style={{fontFamily:fontW(500),fontSize:14,color:sel?'#fff':theme.primary}}>{label}</Text></TouchableOpacity>;
        })}
      </View>
      {/* Macro preview */}
      <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.textSecondary,textAlign:'center'}}>≈{macros.calories} kcal · {macros.protein}g protein</Text>
    </View>;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if(mealStage==='review'||mealStage==='saving'){
    var totals=computeMealTotals();
    var saving=mealStage==='saving';
    var saveDisabled=saving||parsedDishes.some(function(d){return Number((perDishState[d.dish_normalized]||{}).quantity||0)<=0;});
    return <ModalSheet visible={visible} title={editMeal?'Edit meal':'How much did you eat?'} onClose={handleCancel}>
      <CookingStyleToggle/>
      {parsedDishes.map(function(d,i){return <DishRow key={d.dish_normalized} dish={d} first={i===0}/>;})}
      <View style={{paddingVertical:12,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:theme.border,marginBottom:14}}>
        <View style={{flexDirection:'row',justifyContent:'space-between'}}>
          <Caps>Meal total</Caps>
          <Caps color={theme.textSecondary}>{totals.calories} kcal · {totals.protein}g protein</Caps>
        </View>
      </View>
      <PhotoRow/>
      <View style={{flexDirection:'row',gap:10}}>
        <View style={{flex:1}}><SecondaryButton full disabled={saving} onPress={handleCancel}>Cancel</SecondaryButton></View>
        <View style={{flex:1.4}}><PrimaryButton full disabled={saveDisabled} onPress={handleSave}>{saving?'Saving…':editMeal?'Update meal':'Save meal'}</PrimaryButton></View>
      </View>
    </ModalSheet>;
  }

  // Compose stage
  return <ModalSheet visible={visible} title={editMeal?'Edit meal':'Log meal'} onClose={handleCancel}>
    <Caps style={{marginBottom:8}}>Meal time</Caps>
    <MealTimePills/>
    <MemberChips/>
    <DateField label="Date" value={selectedDate} onChange={setSelectedDate} maximumDate={new Date()}/>

    {topDishes.length>0?<View style={{marginBottom:6}}>
      <Caps style={{marginBottom:8}}>Log it again</Caps>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingRight:16}}>
        {topDishes.map(function(td){return <TouchableOpacity key={'qd_'+td.dish_normalized} onPress={function(){handleQuickPickChip(td);}} style={{
          height:36,paddingHorizontal:14,borderRadius:9999,
          alignItems:'center',justifyContent:'center',
          backgroundColor:theme.primaryLight,borderWidth:0,
        }}><Text style={{fontFamily:fontW(500),fontSize:14,color:theme.primary}}>{td.dish_name}</Text></TouchableOpacity>;})}
      </ScrollView>
      <Caps color={theme.muted} style={{marginTop:6,marginBottom:14}}>Tap to log this again</Caps>
    </View>:null}

    <Caps style={{marginBottom:8}}>What did you eat?</Caps>
    <TextInput
      style={[z.inp,{height:88,textAlignVertical:'top',paddingTop:10,marginBottom:6,backgroundColor:theme.surface,color:theme.text,borderColor:theme.primary,borderWidth:1.5}]}
      value={itemsText} onChangeText={setItemsText} maxLength={LIMITS.meal.descMax}
      placeholder={'What did you eat? E.g. 2 rotis, dal, sabzi'}
      placeholderTextColor={theme.muted} multiline
    />
    <Caps color={theme.muted} style={{marginBottom:14}}>{topDishes.length>0?'Or tap a chip above to log it again.':'Write naturally — we’ll figure out the dishes.'}</Caps>

    <PhotoRow/>

    {parseError?<View style={{marginBottom:12,padding:12,borderRadius:12,backgroundColor:theme.accentLight}}>
      <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.accent,lineHeight:18}}>{parseError}</Text>
    </View>:null}

    <View style={{flexDirection:'row',gap:10,marginTop:4}}>
      <View style={{flex:1}}><SecondaryButton full onPress={handleCancel}>Cancel</SecondaryButton></View>
      <View style={{flex:1.4}}><PrimaryButton full disabled={parsing||!itemsText.trim()} onPress={function(){parseAndAdvance(itemsText);}}>{parsing?'Reading…':'Continue'}</PrimaryButton></View>
    </View>
  </ModalSheet>;
}

function AddGoalModal({visible,onClose,defaultGoalType,defaultCategory,prefillName,contextLabel}){
  var theme=useThemeColors();
  var{familyId,userId,refreshGoals,refreshSharedGoals,refreshSharedGoalContributions,upsertGoalLocal,logActivity,currentUserName}=useApp();
  var[name,setName]=useState('');var[target,setTarget]=useState('');var[current,setCurrent]=useState('0');
  var[goalType,setGoalType]=useState(defaultGoalType||'personal');
  var[category,setCategory]=useState(defaultCategory||'Savings');
  var[categoryOther,setCategoryOther]=useState(''); // PHASE 6: free-text when category === 'Other'
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
      setCategoryOther('');
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
      // PHASE 6: when category === 'Other', persist the user-typed text
      var catOtherClean=category==='Other'?normalizeText(categoryOther):'';
      if(category==='Other'&&!catOtherClean){Alert.alert('Validation error','Please specify what “Other” means.');setLoading(false);return;}
      if(!isWellnessContext&&goalType==='shared'){
        var sharedPayload={family_id:familyId,goal_name:cleanName,target_amount:targetNum,current_amount:currentNum,created_by:userId,category:category,category_other:catOtherClean||null,description:''};
        if(useTargetDate)sharedPayload.target_date=isoDate(targetDate);
        var sharedRes=await supabase.from('shared_goals').insert(sharedPayload).select().single();
        if(sharedRes.error)throw sharedRes.error;
        await refreshSharedGoals();
        await refreshSharedGoalContributions();
        if(logActivity){
          await logActivity('shared_goal',{user_name:currentUserName||'Someone',action:'created',goal_name:cleanName,target_amount:targetNum,current_amount:currentNum,category:category,category_other:catOtherClean,goal_scope:'family'},sharedRes.data&&sharedRes.data.id,familyId);
        }
      } else {
        var basePayload={family_id:familyId,name:cleanName,target:targetNum,current:currentNum,goal_type:'personal',is_shared:false};
        var personalPayload=Object.assign({},basePayload,{category:category,category_other:catOtherClean||null,target_date:useTargetDate?isoDate(targetDate):null,goal_scope:'personal'});
        var goalRes=await insertPersonalGoal(personalPayload,basePayload);
        if(goalRes.error)throw goalRes.error;
        upsertGoalLocal(goalRes.data);
        await refreshGoals();
        if(logActivity){
          await logActivity('goal',{user_name:currentUserName||'Someone',action:'created',goal_name:cleanName,target_amount:targetNum,current_amount:currentNum,category:category,category_other:catOtherClean,goal_scope:'personal'},goalRes.data&&goalRes.data.id,familyId);
        }
      }
      onClose();
    }catch(e){
      console.log('[GOAL INSERT ERROR]',e);
      showFriendlyError('Could not save goal',e);
    }
    setLoading(false);
  }

  return(<ModalSheet visible={visible} title={contextLabel?('New '+contextLabel.toLowerCase()+' goal'):'New goal'} onClose={onClose}>
    {!isWellnessContext&&<>
      <Caps style={{marginBottom:8}}>Goal type</Caps>
      <View style={{flexDirection:'row',gap:8,marginBottom:6}}>
        <TouchableOpacity style={[z.chip,goalType==='personal'&&z.chipSel]} onPress={function(){setGoalType('personal');}}><Text style={[z.chipTx,goalType==='personal'&&z.chipSelTx]}>Personal goal</Text></TouchableOpacity>
        <TouchableOpacity style={[z.chip,goalType==='shared'&&z.chipSel]} onPress={function(){setGoalType('shared');}}><Text style={[z.chipTx,goalType==='shared'&&z.chipSelTx]}>Shared family goal</Text></TouchableOpacity>
      </View>
      <Caps color={theme.muted} style={{marginBottom:12}}>{goalType==='personal'?'Only you can update this goal.':'All family members can view and contribute.'}</Caps>
    </>}
    <Inp label="Goal name" value={name} onChangeText={setName} placeholder={isWellnessContext?"Run 5km weekly, Hit 70g protein daily...":"Save for bike, Emergency fund..."} maxLength={LIMITS.goals.nameMax}/>
    {isWellnessContext?(
      <>
        <Inp label="Target" value={target} onChangeText={setTarget} placeholder="e.g. 5 (km), 70 (grams), 8 (hours)" keyboardType="numeric"/>
        <Caps color={theme.textSecondary} style={{marginTop:-2,marginBottom:12}}>Tip: kms, grams, hours, days, books — any units.</Caps>
        <Inp label="Current progress (optional)" value={current} onChangeText={setCurrent} placeholder="0" keyboardType="numeric"/>
      </>
    ):(
      <>
        <Inp label="Target amount" value={target} onChangeText={setTarget} placeholder="100" keyboardType="numeric"/>
        <Inp label="Current amount (optional)" value={current} onChangeText={setCurrent} placeholder="0" keyboardType="numeric"/>
      </>
    )}
    <SelectField label="Category" value={category} onChange={function(v){setCategory(v);if(v!=='Other')setCategoryOther('');}} options={contextLabel==='Wellness'?WELLNESS_GOAL_CATEGORY_OPTIONS:SHARED_GOAL_CATEGORY_OPTIONS} placeholder="Select category"/>
    {category==='Other'&&<Inp label="Specify other" value={categoryOther} onChangeText={setCategoryOther} placeholder="Tell us what 'Other' means" maxLength={40}/>}
    <TouchableOpacity style={{flexDirection:'row',alignItems:'center',marginBottom:12}} onPress={function(){setUseTargetDate(!useTargetDate);}}>
      <View style={{
        width:18,height:18,borderRadius:6,marginRight:10,
        backgroundColor:useTargetDate?theme.primary:'transparent',
        borderWidth:1.5,borderColor:useTargetDate?theme.primary:theme.muted,
        alignItems:'center',justifyContent:'center',
      }}>{useTargetDate&&<Text style={{color:'#fff',fontSize:11,fontWeight:'700'}}>✓</Text>}</View>
      <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.text}}>Set target date (optional)</Text>
    </TouchableOpacity>
    {useTargetDate&&<DateField label="Target date" value={targetDate} onChange={setTargetDate} minimumDate={todayStart} maximumDate={maxTargetDate}/>}
    <View style={{flexDirection:'row',gap:10,marginTop:8}}>
      <View style={{flex:1}}><SecondaryButton full onPress={onClose}>Cancel</SecondaryButton></View>
      <View style={{flex:1.4}}><PrimaryButton full disabled={loading} onPress={save}>{loading?'Saving…':'Create goal'}</PrimaryButton></View>
    </View>
  </ModalSheet>);
}

function EditGoalModal({visible,onClose,goal,familyId}){
  var theme=useThemeColors();
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
  return(<ModalSheet visible={visible} title="Edit goal" onClose={onClose}>
    <Inp label="Goal name" value={name} onChangeText={setName} maxLength={LIMITS.goals.nameMax}/>
    <Inp label="Target" value={target} onChangeText={setTarget} keyboardType="numeric"/>
    <Inp label="Current progress" value={current} onChangeText={setCurrent} keyboardType="numeric"/>
    <View style={{flexDirection:'row',gap:10,marginTop:4}}>
      <View style={{flex:1}}><SecondaryButton full onPress={onClose}>Cancel</SecondaryButton></View>
      <View style={{flex:1.4}}><PrimaryButton full disabled={loading} onPress={save}>{loading?'Saving…':'Save changes'}</PrimaryButton></View>
    </View>
    <TouchableOpacity onPress={deleteGoal} style={{marginTop:14,height:48,borderRadius:12,paddingHorizontal:22,alignItems:'center',justifyContent:'center',borderWidth:1.5,borderColor:theme.danger,backgroundColor:'transparent'}}>
      <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:14,color:theme.danger}}>Delete goal</Text>
    </TouchableOpacity>
  </ModalSheet>);
}

// B3: Split the old combined LogWellnessModal into two dedicated modals —
// one for water, one for screen time — each opens directly with no intermediate step.
function TransactionCommentsModal({visible,onClose,transaction}){
  var theme=useThemeColors();
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

  return <ModalSheet visible={visible} title="Comments" onClose={onClose} scroll={false}>
    {transaction?<Block style={{padding:14,marginBottom:12}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'}}>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:15,color:theme.text}}>{transaction.merchant||'Transaction'}</Text>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:15,color:theme.text}}>{transaction.category==='Income'?'+':'−'}₹{fmt(Math.abs(Number(transaction.amount)||0))}</Text>
      </View>
      <Caps color={theme.muted} style={{marginTop:4}}>{transaction.category||'Uncategorized'}{transaction.date?' · '+displayDate(toDate(transaction.date)):''}</Caps>
    </Block>:null}
    <ScrollView style={{maxHeight:320,marginBottom:10}} showsVerticalScrollIndicator={false}>
      {comments.map(function(c){
        var mine=c.user_id===userId;
        return <View key={c.id} style={{
          alignSelf:mine?'flex-end':'flex-start',
          backgroundColor:mine?theme.primary:theme.surface,
          borderWidth:mine?0:StyleSheet.hairlineWidth,borderColor:theme.border,
          borderRadius:16,padding:10,marginBottom:8,maxWidth:'85%',
        }}>
          <View style={{flexDirection:'row',alignItems:'baseline',marginBottom:3}}>
            <Caps color={mine?'rgba(255,255,255,0.75)':theme.textSecondary}>{mine?'You':(c.user_name||'Member')}</Caps>
            <Caps color={mine?'rgba(255,255,255,0.6)':theme.muted} style={{marginLeft:8}}>{relativeTime(c.created_at)}</Caps>
          </View>
          <Text style={{fontFamily:FF.sans,fontSize:14,color:mine?'#fff':theme.text}}>{c.comment_text}</Text>
        </View>;
      })}
      {comments.length===0&&<Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted}}>No comments yet. Start the conversation.</Text>}
    </ScrollView>
    <View style={{flexDirection:'row',alignItems:'flex-end',gap:8}}>
      <TextInput style={[z.inp,{flex:1,height:44,backgroundColor:theme.surface,color:theme.text,borderColor:theme.border}]} value={text} onChangeText={setText} placeholder="Write a comment…" placeholderTextColor={theme.muted}/>
      <TouchableOpacity onPress={send} disabled={sending||!text.trim()} style={{height:44,paddingHorizontal:18,borderRadius:9999,backgroundColor:theme.primary,alignItems:'center',justifyContent:'center',opacity:sending||!text.trim()?0.5:1}}>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:12,color:'#fff'}}>{sending?'…':'Send'}</Text>
      </TouchableOpacity>
    </View>
  </ModalSheet>;
}

function InvitationConfirmModal({commitment,promise,onClose}){
  var theme=useThemeColors();
  var{members,editAndConfirmPromiseCommitment,memberProfiles,userId,currentUserName}=useApp();
  function rname(m){return resolveMemberName(m,memberProfiles,userId,currentUserName);}
  var[text,setText]=useState('');
  var[ctype,setCtype]=useState('custom');
  var[targetHours,setTargetHours]=useState(null);
  var[saving,setSaving]=useState(false);

  useEffect(function(){
    if(commitment){
      setText(commitment.commitment_text||'');
      setCtype(commitment.commitment_type||'custom');
      var t=commitment.commitment_target&&commitment.commitment_target.target_hours;
      setTargetHours(typeof t==='number'?t:null);
    }
  },[commitment]);

  if(!commitment||!promise)return null;

  var creator=(members||[]).find(function(m){
    return m.userId===promise.created_by;
  });
  var creatorName=creator?rname(creator):'Someone';

  async function save(){
    if(saving)return;
    var trimmed=(text||'').trim();
    if(trimmed.length<4){haptic('error');return;}
    var stickErr=checkPromiseStickFilter(trimmed);
    if(stickErr){
      Alert.alert('Try again',stickErr);
      return;
    }
    setSaving(true);
    try{
      var newTarget=null;
      if(ctype==='screen_under_target'){
        var hrs=targetHours;
        newTarget={target_hours:(typeof hrs==='number'&&hrs>0&&hrs<=24)?hrs:4};
      }
      var ok=await editAndConfirmPromiseCommitment(commitment.id,trimmed,ctype,newTarget);
      if(ok){onClose();}
    }finally{
      setSaving(false);
    }
  }

  return <Modal visible={!!commitment} animationType="slide" transparent onRequestClose={onClose}>
    <View style={z.modalWrap}>
      <View style={[z.modal,{backgroundColor:theme.surface,maxHeight:'85%'}]}>
        <View style={{flexDirection:'row',justifyContent:'flex-end',paddingBottom:4}}>
          <TouchableOpacity onPress={onClose}
            style={{padding:8,marginRight:-8,marginTop:-8}}
            hitSlop={{top:12,bottom:12,left:12,right:12}}>
            <Text style={{fontSize:24,color:theme.muted,lineHeight:24}}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView>
          <Text style={[z.h1,{color:theme.text}]}>{promise.title}</Text>
          <Text style={[z.cap,{marginBottom:4}]}>{displayDate(promise.start_date)} to {displayDate(promise.end_date)}</Text>
          <Text style={[z.cap,{marginBottom:16,color:theme.muted}]}>
            {creatorName} suggested this for you. Edit if you want to make it your own.
          </Text>

          <Text style={[z.cap,{color:theme.muted,marginBottom:6}]}>How will we track this?</Text>
          <View style={[z.row,{flexWrap:'wrap',gap:6,marginBottom:8}]}>
            {[
              {key:'custom',label:'Just check in'},
              {key:'meal_log_days',label:'Daily meal logging'},
              {key:'screen_under_target',label:'Screen under target'},
            ].map(function(opt){
              var sel=ctype===opt.key;
              return <TouchableOpacity key={opt.key}
                style={[z.chip,sel&&z.chipSel]}
                onPress={function(){setCtype(opt.key);}}>
                <Text style={[z.chipTx,sel&&z.chipSelTx]}>{opt.label}</Text>
              </TouchableOpacity>;
            })}
          </View>

          {ctype==='screen_under_target'&&<View style={{marginBottom:8}}>
            <Inp label="Hours per day (default 4)"
              value={targetHours!=null?String(targetHours):''}
              onChangeText={function(v){
                var n=v===''?null:Number(v);
                setTargetHours(isNaN(n)?null:n);
              }}
              placeholder="4"
              keyboardType="numeric"/>
          </View>}

          <Inp
            label={"What you'll do"}
            value={text}
            onChangeText={setText}
            placeholder={
              ctype==='meal_log_days'?"I'll log dinners every night":
              ctype==='screen_under_target'?"I'll keep screen time under 4 hours":
              "I'll be there when it matters"
            }
            maxLength={240}
            multiline/>

          <View style={{flexDirection:'row',gap:8,marginTop:20}}>
            <TouchableOpacity
              style={{flex:1,padding:12,alignItems:'center'}}
              onPress={onClose}
              disabled={saving}>
              <Text style={{color:theme.muted,fontWeight:'500'}}>Cancel</Text>
            </TouchableOpacity>
            <View style={{flex:2}}>
              <PrimaryButton full disabled={saving} onPress={save}>{saving?'Saving...':'Confirm'}</PrimaryButton>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function NewPromiseModal({visible,onClose,onCreated}){
  var theme=useThemeColors();
  var{familyId,members,userId,currentUserName,logActivity,
      refreshPromises,refreshPromiseCommitments,
      promises,promiseCommitments,memberProfiles}=useApp();
  function rname(m){return resolveMemberName(m,memberProfiles,userId,currentUserName);}

  var[step,setStep]=useState(1);
  var[selectedMemberIds,setSelectedMemberIds]=useState([]);
  var[template,setTemplate]=useState('');
  var[commitments,setCommitments]=useState({});
  var[startDate,setStartDate]=useState(new Date());
  var[endDate,setEndDate]=useState(function(){
    var d=new Date();d.setDate(d.getDate()+30);return d;
  });
  var[title,setTitle]=useState('');
  var[saving,setSaving]=useState(false);
  var[filterError,setFilterError]=useState({});

  useEffect(function(){
    if(visible){
      setStep(1);setSelectedMemberIds([]);setTemplate('');setCommitments({});
      setStartDate(new Date());
      var d=new Date();d.setDate(d.getDate()+30);setEndDate(d);
      setTitle('');setFilterError({});
    }
  },[visible]);

  useEffect(function(){
    if(endDate<=startDate){
      var d=new Date(startDate);
      d.setDate(d.getDate()+1);
      setEndDate(d);
    }
  },[startDate]);

  var otherMembers=(members||[]).filter(function(m){
    if(!userId)return false;
    return m.userId!==userId;
  });
  var selfMember=(members||[]).find(function(m){return m.userId===userId;});
  var allParticipantIds=selfMember
    ?[selfMember.id].concat(selectedMemberIds)
    :selectedMemberIds.slice();

  function toggleMember(mid){
    if(selfMember&&mid===selfMember.id)return;
    if(selectedMemberIds.indexOf(mid)>=0){
      setSelectedMemberIds(selectedMemberIds.filter(function(x){return x!==mid;}));
    } else {
      setSelectedMemberIds(selectedMemberIds.concat([mid]));
    }
  }

  function setCommitmentField(mid,field,value){
    var next=Object.assign({},commitments);
    next[mid]=Object.assign({text:'',type:'custom'},next[mid]||{});
    next[mid][field]=value;
    setCommitments(next);
    if(field==='text'&&filterError[mid]){
      var nextErrors=Object.assign({},filterError);
      delete nextErrors[mid];
      setFilterError(nextErrors);
    }
  }

  function canAdvance(){
    if(step===1)return selectedMemberIds.length>=1;
    if(step===2){
      return allParticipantIds.every(function(mid){
        var c=commitments[mid];
        return c&&c.text&&c.text.length>=4&&c.text.length<=240;
      });
    }
    if(step===3){
      var diff=(endDate-startDate)/86400000;
      return diff>=0&&diff<=90;
    }
    return true;
  }

  async function save(){
    if(saving)return;

    var errors={};var hasErrors=false;
    allParticipantIds.forEach(function(mid){
      var text=commitments[mid]&&commitments[mid].text;
      var err=checkPromiseStickFilter(text);
      if(err){errors[mid]=err;hasErrors=true;}
    });
    if(hasErrors){
      setFilterError(errors);
      haptic('error');
      return;
    }

    // Phase C: pair-already-active UX guard. If the user is trying to
    // make a Promise with someone they already have an active Promise
    // with, surface a confirmation step. The DB constraint (one active
    // pair) catches the worst case, but this gives the user a chance
    // to back out and refine the existing one instead.
    if(promiseCommitments&&promises&&selfMember){
      var activePromisesGuard=(promises||[]).filter(function(p){
        return p.status==='active';
      });
      var conflictPromise=null;
      var conflictMemberName=null;

      for(var pi=0;pi<activePromisesGuard.length&&!conflictPromise;pi++){
        var ap=activePromisesGuard[pi];
        var apCommitMembers=(promiseCommitments||[])
          .filter(function(pc){return pc.promise_id===ap.id;})
          .map(function(pc){return pc.member_id;});

        if(apCommitMembers.indexOf(selfMember.id)>=0){
          for(var si=0;si<selectedMemberIds.length;si++){
            if(apCommitMembers.indexOf(selectedMemberIds[si])>=0){
              conflictPromise=ap;
              var cm=(members||[]).find(function(m){
                return m.id===selectedMemberIds[si];
              });
              conflictMemberName=cm?cm.name:'them';
              break;
            }
          }
        }
      }

      if(conflictPromise){
        var confirmed=await new Promise(function(resolve){
          Alert.alert(
            'Already a promise here',
            'You and '+conflictMemberName+' already have "'
              +conflictPromise.title+'" running. Make a new one anyway?',
            [
              {text:'Cancel',style:'cancel',onPress:function(){resolve(false);}},
              {text:'Make another',onPress:function(){resolve(true);}}
            ]
          );
        });
        if(!confirmed)return;
      }
    }

    setSaving(true);
    try{
      var involvesMinor=false;
      try{
        var participantUserIds=(members||[])
          .filter(function(m){return allParticipantIds.indexOf(m.id)>=0&&m.userId;})
          .map(function(m){return m.userId;});
        if(participantUserIds.length>0){
          var dobRes=await supabase.from('users').select('id, dob')
            .in('id',participantUserIds);
          if(dobRes.data){
            var now=new Date();
            involvesMinor=dobRes.data.some(function(u){
              if(!u.dob)return false;
              var dob=new Date(u.dob);
              var ageYears=(now-dob)/(365.25*86400000);
              return ageYears<18;
            });
          }
        }
      }catch(e){console.log('[MINOR CHECK ERROR]',e);}

      var defaultTitle=rname(selfMember)+' & '
        +((members||[]).filter(function(m){
            return selectedMemberIds.indexOf(m.id)>=0;
          }).map(rname).join(' & '))
        +"'s promise";
      var promisePayload={
        family_id:familyId,
        title:(title||'').trim()||defaultTitle,
        start_date:isoDate(startDate),
        end_date:isoDate(endDate),
        status:'active',
        visibility:involvesMinor?'participants_plus_admin':'family',
        involves_minor:involvesMinor,
        created_by:userId,
      };
      var insRes=await supabase.from('promises').insert(promisePayload)
        .select().single();
      if(insRes.error)throw insRes.error;
      var newPromise=insRes.data;

      var commitmentRows=allParticipantIds.map(function(mid){
        var member=(members||[]).find(function(m){return m.id===mid;});
        var c=commitments[mid]||{};
        var ctype=c.type||'custom';
        var ctarget=null;
        if(ctype==='screen_under_target'){
          var hrs=c.targetHours;
          ctarget={target_hours:(typeof hrs==='number'&&hrs>0&&hrs<=24)?hrs:4};
        }
        // Creator's own commitment is auto-confirmed; everyone else
        // gets 'pending' until they confirm/edit/decline from the
        // "Promises waiting on you" section.
        var isSelf=selfMember&&mid===selfMember.id;
        return {
          promise_id:newPromise.id,
          member_id:mid,
          user_id:member?member.userId:null,
          commitment_text:(c.text||'').trim(),
          commitment_type:ctype,
          commitment_target:ctarget,
          commitment_status:isSelf?'confirmed':'pending',
        };
      });
      var commitsRes=await supabase.from('promise_commitments')
        .insert(commitmentRows);
      if(commitsRes.error)throw commitsRes.error;

      if(logActivity){
        await logActivity('promise',{
          user_name:currentUserName||'Someone',
          action:'created',
          title:newPromise.title,
          promise_id:newPromise.id,
        },newPromise.id);
      }

      if(refreshPromises)await refreshPromises();
      if(refreshPromiseCommitments)await refreshPromiseCommitments();
      haptic('success');
      if(onCreated)onCreated(newPromise);
      onClose();
    }catch(e){
      haptic('error');
      showFriendlyError('Could not create promise',e);
    }finally{
      setSaving(false);
    }
  }

  var templates=[
    {key:'parent_child',label:'Parent and child'},
    {key:'child_first',label:'Child writes first'},
    {key:'partners',label:'Partners'},
    {key:'whole_family',label:'Whole family'},
    {key:'custom',label:"Write our own"},
  ];

  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={z.modalWrap}>
      <View style={[z.modal,{backgroundColor:theme.surface,maxHeight:'90%'}]}>
        <View style={{flexDirection:'row',justifyContent:'flex-end',paddingBottom:4}}>
          <TouchableOpacity onPress={onClose}
            style={{padding:8,marginRight:-8,marginTop:-8}}
            hitSlop={{top:12,bottom:12,left:12,right:12}}>
            <Text style={{fontSize:24,color:theme.muted,lineHeight:24}}>×</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{flexGrow:0}}>
          <Text style={[z.h1,{color:theme.text}]}>Make a promise</Text>
          <Text style={[z.cap,{marginBottom:16}]}>Step {step} of 3</Text>

          {step===1&&<View>
            <Text style={[z.body,{color:theme.text,marginBottom:12}]}>{"Who's in this with you?"}</Text>
            <View style={[z.row,{flexWrap:'wrap',gap:6}]}>
              {otherMembers.map(function(m){
                var sel=selectedMemberIds.indexOf(m.id)>=0;
                return <TouchableOpacity key={m.id}
                  style={[z.chip,sel&&z.chipSel]}
                  onPress={function(){toggleMember(m.id);}}>
                  <Text style={[z.chipTx,sel&&z.chipSelTx]}>{rname(m)}</Text>
                </TouchableOpacity>;
              })}
            </View>
            {otherMembers.length===0&&<Text style={[z.cap,{color:theme.muted,marginTop:8}]}>No other family members yet. Add someone to the family first.</Text>}

            <Text style={[z.body,{color:theme.text,marginTop:20,marginBottom:12}]}>Want a starting point?</Text>
            {templates.map(function(t){
              var sel=template===t.key;
              return <TouchableOpacity key={t.key}
                style={[z.card,{marginBottom:8,borderColor:sel?theme.primary:'#E0E0DB'}]}
                onPress={function(){setTemplate(t.key);}}>
                <Text style={[z.txM,{color:theme.text}]}>{t.label}</Text>
              </TouchableOpacity>;
            })}
          </View>}

          {step===2&&<View>
            <Text style={[z.body,{color:theme.text,marginBottom:4}]}>{"What you'll each do"}</Text>
            <Text style={[z.cap,{color:theme.muted,marginBottom:12}]}>{"Promises are reciprocal. Both of you write what you'll do, not what you want from the other."}</Text>
            {allParticipantIds.map(function(mid){
              var member=(members||[]).find(function(m){return m.id===mid;});
              var name=rname(member);
              var c=commitments[mid]||{text:'',type:'custom'};
              var err=filterError[mid];
              var typeOpts=[
                {key:'custom',label:'Just check in'},
                {key:'meal_log_days',label:'Daily meal logging'},
                {key:'screen_under_target',label:'Screen under target'},
              ];
              return <View key={mid} style={{marginBottom:16}}>
                <Text style={[z.txM,{color:theme.text,marginBottom:4}]}>{name}</Text>

                <Text style={[z.cap,{color:theme.muted,marginBottom:6}]}>How will we track this?</Text>
                <View style={[z.row,{flexWrap:'wrap',gap:6,marginBottom:8}]}>
                  {typeOpts.map(function(opt){
                    var sel=(c.type||'custom')===opt.key;
                    return <TouchableOpacity key={opt.key}
                      style={[z.chip,sel&&z.chipSel]}
                      onPress={function(){setCommitmentField(mid,'type',opt.key);}}>
                      <Text style={[z.chipTx,sel&&z.chipSelTx]}>{opt.label}</Text>
                    </TouchableOpacity>;
                  })}
                </View>

                {c.type==='screen_under_target'&&<View style={{marginBottom:8}}>
                  <Inp label="Hours per day (default 4)"
                    value={c.targetHours!=null?String(c.targetHours):''}
                    onChangeText={function(v){
                      var n=v===''?null:Number(v);
                      setCommitmentField(mid,'targetHours',isNaN(n)?null:n);
                    }}
                    placeholder="4"
                    keyboardType="numeric"/>
                </View>}

                <Inp
                  label={"What they'll do"}
                  value={c.text}
                  onChangeText={function(v){setCommitmentField(mid,'text',v);}}
                  placeholder={
                    c.type==='meal_log_days'?"I'll log dinners every night":
                    c.type==='screen_under_target'?"I'll keep screen time under 4 hours":
                    "I'll be there when it matters"
                  }
                  maxLength={240}
                  multiline
                />
                {err&&<Text style={[z.cap,{color:'#BA7517',marginTop:4}]}>{err}</Text>}
              </View>;
            })}
          </View>}

          {step===3&&<View>
            <Text style={[z.body,{color:theme.text,marginBottom:12}]}>When + name</Text>
            <DateField label="Start date" value={startDate} onChange={setStartDate}/>
            <DateField label="End date" value={endDate} onChange={setEndDate}
              minimumDate={(function(){var d=new Date(startDate);d.setDate(d.getDate()+1);return d;})()}
              maximumDate={(function(){var d=new Date(startDate);d.setDate(d.getDate()+90);return d;})()}/>
            <Text style={[z.cap,{color:theme.muted,marginTop:8,marginBottom:16}]}>Up to 90 days.</Text>
            <Inp label="Name (optional)" value={title} onChangeText={setTitle}
              placeholder="Headphones month" maxLength={80}/>
            <Text style={[z.cap,{color:theme.muted,marginTop:12}]}>
              {selectedMemberIds.some(function(mid){
                var m=(members||[]).find(function(mm){return mm.id===mid;});
                return m&&m.userId;
              })?'Family will see this in the activity feed.':''}
            </Text>
          </View>}

          <View style={{flexDirection:'row',gap:8,marginTop:20}}>
            {step>1&&<View style={{flex:1}}><SecondaryButton full onPress={function(){setStep(step-1);}}>Back</SecondaryButton></View>}
            {step<3&&<View style={{flex:1}}><PrimaryButton full disabled={!canAdvance()} onPress={function(){setStep(step+1);}}>Next</PrimaryButton></View>}
            {step===3&&<View style={{flex:1}}><PrimaryButton full disabled={saving} onPress={save}>{saving?'Saving...':'Send invitations'}</PrimaryButton></View>}
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function PromiseDetailModal({promise,onClose}){
  var theme=useThemeColors();
  var{members,userId,currentUserName,promiseCommitments,promiseSnapshots,
      logActivity,refreshPromises,refreshPromiseCommitments,memberProfiles}=useApp();
  function rname(m){return resolveMemberName(m,memberProfiles,userId,currentUserName);}
  var[busy,setBusy]=useState(false);

  if(!promise)return null;

  var commitments=(promiseCommitments||[]).filter(function(c){
    return c.promise_id===promise.id;
  });

  async function markCommitmentDone(commitmentId){
    if(busy)return;
    setBusy(true);
    try{
      var r=await supabase.from('promise_commitments').update({
        manually_marked_done:true,
        manually_marked_done_at:new Date().toISOString(),
      }).eq('id',commitmentId);
      if(r.error)throw r.error;
      haptic('success');
      if(refreshPromiseCommitments)await refreshPromiseCommitments();
    }catch(e){
      haptic('error');
      showFriendlyError('Could not mark done',e);
    }finally{setBusy(false);}
  }

  async function pausePromise(){
    Alert.alert(
      'Pause this promise',
      'Pause until you both want to pick it back up?',
      [
        {text:'Cancel',style:'cancel'},
        {text:'Pause',onPress:async function(){
          if(busy)return;
          setBusy(true);
          try{
            var r=await supabase.from('promises').update({
              status:'paused',
              updated_at:new Date().toISOString(),
            }).eq('id',promise.id);
            if(r.error)throw r.error;
            if(logActivity){
              await logActivity('promise',{
                user_name:currentUserName||'Someone',
                action:'paused',
                title:promise.title,
              },promise.id);
            }
            haptic('success');
            if(refreshPromises)await refreshPromises();
            onClose();
          }catch(e){
            haptic('error');
            showFriendlyError('Could not pause',e);
          }finally{setBusy(false);}
        }}
      ]
    );
  }

  async function cancelPromise(){
    Alert.alert(
      'Set this aside',
      'Cancel this promise, both of you, no questions asked?',
      [
        {text:'Keep going',style:'cancel'},
        {text:'Set aside',style:'destructive',onPress:async function(){
          if(busy)return;
          setBusy(true);
          try{
            var r=await supabase.from('promises').update({
              status:'cancelled',
              updated_at:new Date().toISOString(),
            }).eq('id',promise.id);
            if(r.error)throw r.error;
            if(logActivity){
              await logActivity('promise',{
                user_name:currentUserName||'Someone',
                action:'cancelled',
                title:promise.title,
              },promise.id);
            }
            haptic('success');
            if(refreshPromises)await refreshPromises();
            onClose();
          }catch(e){
            haptic('error');
            showFriendlyError('Could not cancel',e);
          }finally{setBusy(false);}
        }}
      ]
    );
  }

  var statusLabel=promise.status==='active'?'Active'
    :promise.status==='paused'?'Paused'
    :promise.status==='complete'?'Complete'
    :promise.status==='wound_down'?'Wrapped up'
    :promise.status==='cancelled'?'Set aside':promise.status;

  return <Modal visible={!!promise} animationType="slide" transparent onRequestClose={onClose}>
    <View style={z.modalWrap}>
      <View style={[z.modal,{backgroundColor:theme.surface,maxHeight:'85%'}]}>
        <ScrollView>
          <Text style={[z.h1,{color:theme.text}]}>{promise.title}</Text>
          <Text style={[z.cap,{color:theme.muted,marginBottom:4}]}>
            {displayDate(promise.start_date)} to {displayDate(promise.end_date)}
          </Text>
          <Text style={[z.cap,{marginBottom:16,color:theme.primary}]}>{statusLabel}</Text>

          {commitments.map(function(c){
            var member=(members||[]).find(function(m){return m.id===c.member_id;});
            var name=rname(member);
            var isMine=c.user_id===userId;

            var snaps=(promiseSnapshots||[]).filter(function(s){return s.commitment_id===c.id;});
            snaps.sort(function(a,b){return a.snapshot_date<b.snapshot_date?1:-1;});
            var snap=snaps[0]||null;

            var isManualOnly=c.commitment_type==='custom'||!snap||snap.progress_target===null;

            return <View key={c.id} style={[z.card,{marginBottom:8}]}>
              <Text style={[z.txM,{color:theme.text}]}>{name}</Text>
              {c.commitment_status!=='confirmed'&&<View style={{
                alignSelf:'flex-start',
                paddingVertical:2,paddingHorizontal:8,
                borderRadius:10,marginVertical:4,
                backgroundColor:c.commitment_status==='pending'?'#FCEBC4':'#EAE6DD'
              }}>
                <Text style={{
                  fontSize:11,
                  color:c.commitment_status==='pending'?'#8A6B14':'#6B5E52',
                  fontWeight:'500'
                }}>
                  {c.commitment_status==='pending'?'waiting':'declined'}
                </Text>
              </View>}
              <Text style={[z.body,{color:theme.text,marginVertical:4}]}>{c.commitment_text}</Text>
              {isManualOnly
                ?(c.manually_marked_done
                  ?<Text style={[z.cap,{color:theme.primary,fontWeight:'500'}]}>
                      Marked done{c.manually_marked_done_at?' on '+displayDate(c.manually_marked_done_at):''}
                    </Text>
                  :(isMine&&promise.status==='active'&&c.commitment_status==='confirmed'
                    ?<View style={{marginTop:6,alignSelf:'flex-start'}}><SecondaryButton onPress={function(){markCommitmentDone(c.id);}} disabled={busy}>Mark this done</SecondaryButton></View>
                    :<Text style={[z.cap,{color:theme.muted}]}>In progress</Text>))
                :(function(){
                    var pctProgress=snap.progress_target>0
                      ?Math.min(1,snap.progress_value/snap.progress_target)
                      :0;
                    var startD=new Date(promise.start_date+'T00:00:00Z');
                    var endD=new Date(promise.end_date+'T00:00:00Z');
                    var nowD=new Date();
                    var totalMs=endD-startD;
                    var elapsedMs=Math.max(0,Math.min(totalMs,nowD-startD));
                    var pctElapsed=totalMs>0?elapsedMs/totalMs:0;
                    var atRisk=pctElapsed>0.5&&pctProgress<0.5;
                    var barColor=atRisk?theme.accent:theme.primary;

                    return <View>
                      <View style={{height:8,backgroundColor:'#E8E5DD',borderRadius:4,marginTop:4,overflow:'hidden'}}>
                        <View style={{height:8,width:(pctProgress*100)+'%',backgroundColor:barColor}}/>
                      </View>
                      <Text style={[z.cap,{color:theme.muted,marginTop:4}]}>
                        {snap.progress_value} of {snap.progress_target}
                        {snap.is_on_track===true?' · on track':''}
                        {snap.is_on_track===false?' · catching up':''}
                      </Text>
                    </View>;
                  })()
              }
            </View>;
          })}

          {promise.status==='active'&&<View style={{flexDirection:'row',gap:8,marginTop:16}}>
            <View style={{flex:1}}><SecondaryButton full onPress={pausePromise} disabled={busy}>Pause this for now</SecondaryButton></View>
            <TouchableOpacity
              style={{flex:1,padding:12,alignItems:'center',justifyContent:'center'}}
              onPress={cancelPromise}
              disabled={busy}>
              <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:14,color:'#E24B4A'}}>Set this aside</Text>
            </TouchableOpacity>
          </View>}

          <Text style={[z.cap,{marginTop:16,color:theme.muted}]}>
            Visible to participants{promise.involves_minor?' and family admin':''}.
          </Text>

          <TouchableOpacity style={{marginTop:16,alignSelf:'center'}} onPress={onClose}>
            <Text style={[z.cap,{color:theme.muted}]}>Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function PromiseReflectionModal({promise,onClose,onSubmitted}){
  var theme=useThemeColors();
  var{userId,currentUserName,logActivity,refreshPromiseReflections}=useApp();
  var[felt,setFelt]=useState(null);
  var[note,setNote]=useState('');
  var[saving,setSaving]=useState(false);

  if(!promise)return null;

  var statusFraming=promise.status==='complete'
    ?'You both kept your word.'
    :promise.status==='wound_down'
    ?'It wrapped up. How did it feel?'
    :'You set it aside. That counts too.';

  async function submit(){
    if(!felt||saving)return;
    setSaving(true);
    try{
      var r=await supabase.from('promise_reflections').insert({
        promise_id:promise.id,
        user_id:userId,
        felt:felt,
        note:(note||'').trim()||null,
      });
      if(r.error)throw r.error;

      if(logActivity){
        await logActivity('promise_reflection',{
          user_name:currentUserName||'Someone',
          title:promise.title,
          felt:felt,
        },promise.id);
      }

      if(refreshPromiseReflections)await refreshPromiseReflections();
      haptic('success');
      if(onSubmitted)onSubmitted();
      onClose();
    }catch(e){
      haptic('error');
      showFriendlyError('Could not save',e);
    }finally{
      setSaving(false);
    }
  }

  function skip(){
    // Skip writes nothing. Bootstrap will surface again next open
    // until the reflection exists or 7 days have passed since
    // status change.
    onClose();
  }

  var feltOptions=[
    {key:'good',label:'Good'},
    {key:'mixed',label:'Mixed'},
    {key:'not_great',label:'Not great'},
  ];

  return <Modal visible={!!promise} animationType="slide" transparent onRequestClose={skip}>
    <View style={z.modalWrap}>
      <View style={[z.modal,{backgroundColor:theme.surface,maxHeight:'70%'}]}>
        <View style={{flexDirection:'row',justifyContent:'flex-end',paddingBottom:4}}>
          <TouchableOpacity onPress={skip}
            style={{padding:8,marginRight:-8,marginTop:-8}}
            hitSlop={{top:12,bottom:12,left:12,right:12}}>
            <Text style={{fontSize:24,color:theme.muted,lineHeight:24}}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView>
          <Text style={[z.h1,{color:theme.text}]}>{promise.title}</Text>
          <Text style={[z.cap,{marginBottom:16,color:theme.muted}]}>{statusFraming}</Text>

          <Text style={[z.body,{color:theme.text,marginBottom:8}]}>How did it feel?</Text>
          <View style={[z.row,{gap:8,marginBottom:16}]}>
            {feltOptions.map(function(opt){
              var sel=felt===opt.key;
              return <TouchableOpacity key={opt.key}
                style={{
                  flex:1,padding:12,borderRadius:8,
                  borderWidth:1,
                  borderColor:sel?theme.primary:'#E0E0DB',
                  backgroundColor:sel?theme.primary:'transparent',
                  alignItems:'center'
                }}
                onPress={function(){setFelt(opt.key);}}>
                <Text style={{
                  color:sel?'#fff':theme.text,
                  fontWeight:'500'
                }}>{opt.label}</Text>
              </TouchableOpacity>;
            })}
          </View>

          <Text style={[z.body,{color:theme.text,marginBottom:8}]}>
            {"Anything you'd want to remember? (optional)"}
          </Text>
          <Inp
            value={note}
            onChangeText={setNote}
            placeholder="A line or two, no pressure"
            maxLength={280}
            multiline/>

          <View style={[z.row,{gap:8,marginTop:20}]}>
            <TouchableOpacity
              style={{flex:1,padding:12,alignItems:'center'}}
              onPress={skip}
              disabled={saving}>
              <Text style={{color:theme.muted,fontWeight:'500'}}>Skip for now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex:2,padding:12,borderRadius:8,
                backgroundColor:theme.primary,
                alignItems:'center',
                opacity:(felt&&!saving)?1:0.5
              }}
              disabled={!felt||saving}
              onPress={submit}>
              <Text style={{color:'#fff',fontWeight:'500'}}>
                {saving?'Saving...':'Save reflection'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function SharedGoalModal({visible,onClose,goal}){
  var theme=useThemeColors();
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

  return <ModalSheet visible={visible} title={goal?'Edit shared goal':'New shared goal'} onClose={onClose}>
    <Inp label="Goal name" value={name} onChangeText={setName} placeholder="Family vacation fund"/>
    <Inp label="Target amount" value={target} onChangeText={setTarget} keyboardType="numeric" placeholder="50000"/>
    <DateField label="Target date" value={targetDate} onChange={setTargetDate} minimumDate={todayStart} maximumDate={maxTargetDate}/>
    <SelectField label="Category" value={category} onChange={setCategory} options={SHARED_GOAL_CATEGORY_OPTIONS} placeholder="Select category"/>
    <Inp label="Description" value={description} onChangeText={setDescription} multiline placeholder="Optional details"/>
    <View style={{flexDirection:'row',gap:10,marginTop:8}}>
      <View style={{flex:1}}><SecondaryButton full onPress={onClose}>Cancel</SecondaryButton></View>
      <View style={{flex:1.4}}><PrimaryButton full disabled={saving} onPress={save}>{saving?'Saving…':'Save'}</PrimaryButton></View>
    </View>
  </ModalSheet>;
}

function SharedGoalContributionModal({visible,onClose,goal}){
  var theme=useThemeColors();
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
  return <ModalSheet visible={visible} title="Add to this goal" onClose={onClose}>
    <Caps color={theme.muted} style={{marginBottom:14}}>{goal?goal.goal_name:''}</Caps>
    <Inp label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="1000"/>
    <Inp label="Note (optional)" value={note} onChangeText={setNote} placeholder="For this month's savings"/>
    <View style={{flexDirection:'row',gap:10,marginTop:8}}>
      <View style={{flex:1}}><SecondaryButton full onPress={onClose}>Cancel</SecondaryButton></View>
      <View style={{flex:1.4}}><PrimaryButton full disabled={saving} onPress={add}>{saving?'Saving…':'Add contribution'}</PrimaryButton></View>
    </View>
  </ModalSheet>;
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

  function row(label,value){
    return <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:theme.border}}>
      <Caps>{label}</Caps>
      <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.text,maxWidth:'60%'}} numberOfLines={1}>{value||'—'}</Text>
    </View>;
  }
  return <ModalSheet visible={visible} title="Profile" onClose={onClose}>
    {loadingProfile&&<Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted,marginBottom:8}}>Loading profile data…</Text>}
    {!loadingProfile&&profileData&&<Block style={{padding:14,marginBottom:14}}>
      {row('Name',profileData.name||'Not set yet')}
      {row('Email',profileData.email)}
      {row('Phone',profileData.phone)}
      {row('DOB',profileData.dob)}
      {row('Gender',profileData.gender)}
      {row('Height',profileData.height!==null&&profileData.height!==undefined?profileData.height+' cm':null)}
      {row('Weight',profileData.weight!==null&&profileData.weight!==undefined?profileData.weight+' kg':null)}
      {row('Location',profileData.location)}
      {row('Occupation',profileData.occupation)}
      {row('Language',profileData.language)}
    </Block>}
    {!loadingProfile&&!profileData&&<Text style={{fontFamily:FF.sans,fontSize:14,color:theme.muted}}>No profile data found.</Text>}
    <PrimaryButton full onPress={onClose}>Close</PrimaryButton>
  </ModalSheet>;
}

function LogWaterModal({visible,onClose,initialDate}){
  var theme=useThemeColors();
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
      // Payload includes ONLY water-related fields. Don't cross-fill screen_hrs/sleep_hours
      // — leaving them out preserves NULL on new rows (= "not logged") and existing values
      // on update. The not-logged-vs-zero distinction depends on this. See migration:
      // supabase/migrations/wellness_logged_distinction.sql.
      var payload={family_id:familyId,member_id:mid,member_name:mN?mN.name:'',water:newWaterTotal,date:today,updated_at:new Date().toISOString()};
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
  return(<ModalSheet visible={visible} title="Log water" onClose={onClose}>
    <Caps style={{marginBottom:8}}>Who?</Caps>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16}}>
      {members.map(function(m){return<TouchableOpacity key={m.id} style={[z.chip,mid===m.id&&z.chipSel]} onPress={function(){setMid(m.id);}}><Text style={[z.chipTx,mid===m.id&&z.chipSelTx]}>{m.name}</Text></TouchableOpacity>;})}
    </View>
    <Caps style={{marginBottom:8}}>How many glasses?</Caps>
    <View style={{flexDirection:'row',gap:8,marginBottom:16,alignItems:'center'}}>
      <TouchableOpacity style={[z.stepBtn,{borderColor:theme.border}]} onPress={function(){bump(-1);}}><Text style={[z.stepTx,{color:theme.text}]}>−</Text></TouchableOpacity>
      <TextInput style={[z.inp,{flex:1,textAlign:'center',fontSize:20,backgroundColor:theme.surface,color:theme.text,borderColor:theme.border}]} value={water} onChangeText={setWater} placeholder="0" placeholderTextColor={theme.muted} keyboardType="numeric"/>
      <TouchableOpacity style={[z.stepBtn,{borderColor:theme.border}]} onPress={function(){bump(1);}}><Text style={[z.stepTx,{color:theme.text}]}>+</Text></TouchableOpacity>
    </View>
    <DateField label="Date" value={selectedDate} onChange={setSelectedDate} maximumDate={new Date()}/>
    {mid&&<Caps color={theme.muted} style={{marginBottom:10}}>So far on {isoDate(selectedDate)}: {formatWaterFromLitres((wellness||[]).filter(function(w){return w.memberId===mid&&w.date===isoDate(selectedDate);}).reduce(function(sum,w){return sum+Number(w.water||0);},0))}</Caps>}
    <View style={{flexDirection:'row',gap:10,marginTop:8}}>
      <View style={{flex:1}}><SecondaryButton full onPress={onClose}>Cancel</SecondaryButton></View>
      <View style={{flex:1.4}}><PrimaryButton full disabled={loading} onPress={save}>{loading?'Saving…':'Save water'}</PrimaryButton></View>
    </View>
  </ModalSheet>);
}

function LogScreenTimeModal({visible,onClose,initialDate}){
  var theme=useThemeColors();
  var{familyId,members,userId,isAdmin,wellness,refreshWellness,upsertWellnessLocal,logActivity,currentUserName,screenTargetHrs}=useApp();var[mid,setMid]=useState('');var[hrs,setHrs]=useState('');var[mins,setMins]=useState('');var[loading,setLoading]=useState(false);
  // Default date is YESTERDAY — screen time is end-of-day data, you can't know
  // today's full total until today is over. Caller can pass initialDate to override.
  function defaultLogDate(){var d=new Date();d.setDate(d.getDate()-1);return d;}
  var[selectedDate,setSelectedDate]=useState(defaultLogDate());
  useEffect(function(){if(visible){setMid('');setHrs('');setMins('');setSelectedDate(initialDate?toDate(initialDate):defaultLogDate());}},[visible,initialDate]);
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
      // Payload sets only screen_hrs. Dropped the water cross-fill — see comment in
      // LogWaterModal save above + the wellness_logged_distinction.sql migration.
      var payload={family_id:familyId,member_id:mid,member_name:mN?mN.name:'',screen_hrs:newScreenTotal,date:today,updated_at:new Date().toISOString()};
      var{data,error}=await supabase.from('wellness').upsert(payload,{onConflict:'family_id,member_id,date'}).select().single();
      console.log('[SCREEN UPSERT]',{payload:payload,data:data,error:error});
      if(error)throw error;
      upsertWellnessLocal(normWellness([data])[0]);
      await refreshWellness();
      var sLimit=Number(screenTargetHrs)||2;if(total<=sLimit){await recordScore(familyId,mid,'screen_under_limit',15);}
      await bumpStreak(familyId,mid,'screen');
      if(logActivity){await logActivity('wellness',{user_name:currentUserName||'Someone',log_type:'screen_time',member_name:mN?mN.name:'',screen_added:rounded,screen_total:Number((data&&data.screen_hrs)||0)},data&&data.id,familyId);}
      haptic('medium');
      setMid('');setHrs('');setMins('');setSelectedDate(initialDate?toDate(initialDate):defaultLogDate());onClose();
    }catch(e){console.log('[SCREEN SAVE ERROR]',e);showFriendlyError('Could not save screen time',e);}
    setLoading(false);
  }
  return(<ModalSheet visible={visible} title="Log screen time" onClose={onClose}>
    <Caps style={{marginBottom:8}}>Who?</Caps>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16}}>
      {members.map(function(m){return<TouchableOpacity key={m.id} style={[z.chip,mid===m.id&&z.chipSel]} onPress={function(){setMid(m.id);}}><Text style={[z.chipTx,mid===m.id&&z.chipSelTx]}>{m.name}</Text></TouchableOpacity>;})}
    </View>
    <View style={{flexDirection:'row',gap:8,marginBottom:16}}>
      <View style={{flex:1}}><Caps style={{marginBottom:6}}>Hours</Caps><TextInput style={[z.inp,{backgroundColor:theme.surface,color:theme.text,borderColor:theme.border}]} value={hrs} onChangeText={setHrs} placeholder="3" placeholderTextColor={theme.muted} keyboardType="numeric"/></View>
      <View style={{flex:1}}><Caps style={{marginBottom:6}}>Minutes</Caps><TextInput style={[z.inp,{backgroundColor:theme.surface,color:theme.text,borderColor:theme.border}]} value={mins} onChangeText={setMins} placeholder="15" placeholderTextColor={theme.muted} keyboardType="numeric"/></View>
    </View>
    <DateField label="Date" value={selectedDate} onChange={setSelectedDate} maximumDate={new Date()}/>
    {mid&&<Caps color={theme.muted} style={{marginBottom:10}}>So far on {isoDate(selectedDate)}: {(wellness||[]).filter(function(w){return w.memberId===mid&&w.date===isoDate(selectedDate);}).reduce(function(sum,w){return sum+Number(w.screenHrs||w.screen_hrs||0);},0).toFixed(1)} hrs</Caps>}
    <View style={{flexDirection:'row',gap:10,marginTop:8}}>
      <View style={{flex:1}}><SecondaryButton full onPress={onClose}>Cancel</SecondaryButton></View>
      <View style={{flex:1.4}}><PrimaryButton full disabled={loading} onPress={save}>{loading?'Saving…':'Save screen time'}</PrimaryButton></View>
    </View>
  </ModalSheet>);
}

// LogSleepModal — Part C of the Wellness retrospective build.
// Defaults date to yesterday because logging happens this morning for last night's sleep.
// UPSERT-by-(family_id, member_id, date) means tapping save twice is idempotent / overwrites.
// Number input is single-field hours, with +/- 0.5h steppers and quick-pick chips. NO score,
// NO streak, NO comparison messaging — by deliberate spec.
function LogSleepModal({visible,onClose,initialDate}){
  var theme=useThemeColors();
  var{familyId,members,userId,isAdmin,wellness,refreshWellness,upsertWellnessLocal,logActivity,currentUserName,userProfile}=useApp();
  var[mid,setMid]=useState('');
  var[hrs,setHrs]=useState(7);
  var[loading,setLoading]=useState(false);
  function defaultLogDate(){var d=new Date();d.setDate(d.getDate()-1);return d;}
  var[selectedDate,setSelectedDate]=useState(defaultLogDate());

  useEffect(function(){
    if(!visible)return;
    setLoading(false);
    setSelectedDate(initialDate?toDate(initialDate):defaultLogDate());
    // Default to current user's member row, or empty if can't infer.
    var meMember=(members||[]).find(function(m){return m.userId===userId;});
    var defaultMid=meMember?meMember.id:'';
    setMid(defaultMid);
    // Pre-fill hours from this user's last logged sleep, else their q20 target, else 7.
    var lastForMid=defaultMid?(wellness||[]).filter(function(w){return (w.memberId||w.member_id)===defaultMid&&w.sleep_hours!=null;}).sort(function(a,b){return String(b.date).localeCompare(String(a.date));})[0]:null;
    if(lastForMid&&lastForMid.sleep_hours!=null){setHrs(Number(lastForMid.sleep_hours));}
    else if(userProfile&&userProfile.questionnaire_data&&Number(userProfile.questionnaire_data.q20_sleep_hours)>0){setHrs(Number(userProfile.questionnaire_data.q20_sleep_hours));}
    else{setHrs(7);}
  },[visible,initialDate]);

  function bump(delta){setHrs(function(h){var n=Math.round((Number(h||0)+delta)*2)/2;if(n<0)n=0;if(n>24)n=24;return n;});haptic('light');}

  async function save(){
    if(!mid){Alert.alert('Validation error','Please select a member.');return;}
    if(!canModifyMemberData(isAdmin,members,userId,mid)){Alert.alert('Not allowed','You can only log your own data.');return;}
    var n=Number(hrs);
    if(!isFinite(n)||n<0||n>24){Alert.alert('Validation error','Sleep hours must be between 0 and 24.');return;}
    if(isFutureDate(selectedDate)){Alert.alert('Validation error','Date cannot be in the future.');return;}
    setLoading(true);
    try{
      var dateStr=isoDate(selectedDate);
      var mN=members.find(function(m2){return m2.id===mid;});
      // Sleep payload sets sleep_hours only — same hygiene as LogScreenTimeModal.
      var payload={family_id:familyId,member_id:mid,member_name:mN?mN.name:'',sleep_hours:Math.round(n*10)/10,date:dateStr,updated_at:new Date().toISOString()};
      var{data,error}=await supabase.from('wellness').upsert(payload,{onConflict:'family_id,member_id,date'}).select().single();
      console.log('[SLEEP UPSERT]',{payload:payload,data:data,error:error});
      if(error)throw error;
      upsertWellnessLocal(normWellness([data])[0]);
      await refreshWellness();
      if(logActivity){await logActivity('wellness',{user_name:currentUserName||'Someone',log_type:'sleep',member_name:mN?mN.name:'',sleep_hours:n},data&&data.id,familyId);}
      haptic('medium');
      onClose();
    }catch(e){console.log('[SLEEP SAVE ERROR]',e);showFriendlyError('Could not save sleep',e);}
    setLoading(false);
  }

  var QUICK_HOURS=[5,6,7,8,9,10];
  return(<ModalSheet visible={visible} title="How did you sleep?" onClose={onClose}>
    <Caps style={{marginBottom:6}}>Last night, in hours.</Caps>
    {(members||[]).length>1?<>
      <Caps style={{marginTop:8,marginBottom:8}}>Who?</Caps>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14}}>
        {members.map(function(m){return<TouchableOpacity key={m.id} style={[z.chip,mid===m.id&&z.chipSel]} onPress={function(){setMid(m.id);}}><Text style={[z.chipTx,mid===m.id&&z.chipSelTx]}>{m.name}</Text></TouchableOpacity>;})}
      </View>
    </>:null}
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:14,marginVertical:20}}>
      <TouchableOpacity onPress={function(){bump(-0.5);}} disabled={loading} style={{width:48,height:48,borderRadius:24,backgroundColor:theme.surfaceElevated,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border}}>
        <Text style={{fontFamily:FF.sansBold,fontSize:24,color:theme.text}}>−</Text>
      </TouchableOpacity>
      <View style={{minWidth:120,alignItems:'center'}}>
        <Text style={{fontFamily:FF.sansBold,fontSize:48,color:theme.text,letterSpacing:-1}}>{(Number(hrs)===Math.floor(Number(hrs))?Number(hrs)+'.0':Number(hrs).toFixed(1))}</Text>
        <Caps color={theme.muted}>hours</Caps>
      </View>
      <TouchableOpacity onPress={function(){bump(0.5);}} disabled={loading} style={{width:48,height:48,borderRadius:24,backgroundColor:theme.surfaceElevated,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border}}>
        <Text style={{fontFamily:FF.sansBold,fontSize:24,color:theme.text}}>+</Text>
      </TouchableOpacity>
    </View>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14,justifyContent:'center'}}>
      {QUICK_HOURS.map(function(q){var sel=Number(hrs)===q;return <TouchableOpacity key={'qs_'+q} onPress={function(){setHrs(q);haptic('light');}} style={[z.chip,sel&&z.chipSel]}><Text style={[z.chipTx,sel&&z.chipSelTx]}>{q}h</Text></TouchableOpacity>;})}
    </View>
    <DateField label="Date" value={selectedDate} onChange={setSelectedDate} maximumDate={new Date()}/>
    <View style={{flexDirection:'row',gap:10,marginTop:8}}>
      <View style={{flex:1}}><SecondaryButton full onPress={onClose}>Cancel</SecondaryButton></View>
      <View style={{flex:1.4}}><PrimaryButton full disabled={loading} onPress={save}>{loading?'Saving…':'Save sleep'}</PrimaryButton></View>
    </View>
  </ModalSheet>);
}

// Phase B2: LogActivityModal — clones LogScreenTimeModal pattern. Spec: ACTIVITY_LOGGING_SPEC.md.
// Hybrid: activity_type chips + duration stepper + optional note. NO bumpStreak (decided in spec L153).
var ACTIVITY_TYPES=['walk','workout','run','cycle','yoga','sport','swim','other'];
function LogActivityModal({visible,onClose,initialDate,editActivity}){
  var theme=useThemeColors();
  var{familyId,members,userId,isAdmin,addActivity,updateActivity,logActivity,currentUserName}=useApp();
  var perms=useFamilyPermissions();
  var[mid,setMid]=useState('');
  var[activityType,setActivityType]=useState('');
  var[duration,setDuration]=useState(30);
  var[note,setNote]=useState('');
  var[loading,setLoading]=useState(false);
  var[selectedDate,setSelectedDate]=useState(new Date());
  useEffect(function(){
    if(visible){
      if(editActivity){
        setMid(editActivity.member_id||editActivity.memberId||'');
        setActivityType(editActivity.activity_type||'');
        setDuration(Number(editActivity.duration_minutes)||30);
        setNote(editActivity.note||'');
        setSelectedDate(editActivity.date?toDate(editActivity.date):new Date());
      }else{
        // Members can only log for themselves; auto-set to self.
        var defaultMid=perms.tier==='member'?perms.currentMemberId:'';
        setMid(defaultMid||'');
        setActivityType('');
        setDuration(30);
        setNote('');
        setSelectedDate(initialDate?toDate(initialDate):new Date());
      }
    }
  },[visible,editActivity,initialDate,perms.tier,perms.currentMemberId]);
  function bumpDuration(delta){
    setDuration(function(prev){
      var next=Math.max(5,Math.min(240,(Number(prev)||0)+delta));
      return next;
    });
  }
  async function save(){
    if(!mid){Alert.alert('Validation error','Please select a member.');return;}
    if(!perms.canModifyMemberData(mid)){Alert.alert('Not allowed','You can only log your own activity.');return;}
    if(!activityType){Alert.alert('Validation error','Please pick an activity type.');return;}
    var dur=Number(duration)||0;
    if(dur<5||dur>240){Alert.alert('Validation error','Duration must be 5–240 minutes.');return;}
    if(isFutureDate(selectedDate)){Alert.alert('Validation error','Date cannot be in the future.');return;}
    setLoading(true);
    try{
      var mN=members.find(function(m){return m.id===mid;});
      var payload={
        family_id:familyId,
        user_id:userId,
        member_id:mid,
        member_name:mN?mN.name:'',
        activity_type:activityType,
        duration_minutes:dur,
        note:note&&note.trim()?note.trim().slice(0,200):null,
        date:isoDate(selectedDate),
        source:'manual',
      };
      var saved;
      if(editActivity&&editActivity.id){
        saved=await updateActivity(editActivity.id,payload);
      }else{
        saved=await addActivity(payload);
      }
      if(logActivity){
        await logActivity('activity_logged',{user_name:currentUserName||'Someone',member_name:mN?mN.name:'',activity_type:activityType,duration_minutes:dur,note:payload.note},saved&&saved.id,familyId);
      }
      haptic('success');
      onClose();
    }catch(e){console.log('[LOG ACTIVITY ERROR]',e);haptic('error');showFriendlyError('Could not save activity',e);}
    setLoading(false);
  }
  return(<ModalSheet visible={visible} title={editActivity?'Edit activity':'Log activity'} onClose={onClose}>
    {perms.tier!=='member'?<View>
      <Caps style={{marginBottom:8}}>Who?</Caps>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16}}>
        {members.map(function(m){return<TouchableOpacity key={m.id} style={[z.chip,mid===m.id&&z.chipSel]} onPress={function(){setMid(m.id);}}><Text style={[z.chipTx,mid===m.id&&z.chipSelTx]}>{m.name}</Text></TouchableOpacity>;})}
      </View>
    </View>:null}
    <Caps style={{marginBottom:8}}>Activity type</Caps>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16}}>
      {ACTIVITY_TYPES.map(function(t){
        var sel=activityType===t;
        return <TouchableOpacity key={t} onPress={function(){setActivityType(t);}} style={{
          height:34,paddingHorizontal:14,borderRadius:9999,
          justifyContent:'center',alignItems:'center',
          backgroundColor:sel?theme.primaryLight:theme.surface,
          borderWidth:StyleSheet.hairlineWidth,borderColor:sel?theme.primary:theme.border,
        }}>
          <Text style={{fontFamily:sel?FF.sansSemi:FF.sans,fontSize:13,color:sel?theme.primary:theme.textSecondary,textTransform:'capitalize'}}>{t}</Text>
        </TouchableOpacity>;
      })}
    </View>
    <Caps style={{marginBottom:8}}>Duration</Caps>
    <View style={{flexDirection:'row',gap:12,alignItems:'center',marginBottom:16}}>
      <TouchableOpacity onPress={function(){haptic('light');bumpDuration(-5);}} style={[z.stepBtn,{borderColor:theme.border}]}><Text style={[z.stepTx,{color:theme.text}]}>−</Text></TouchableOpacity>
      <View style={{flex:1,alignItems:'center'}}>
        <Text style={{fontFamily:FF.sansBold,fontSize:32,letterSpacing:-0.8,color:theme.text}}>{duration}<Text style={{fontFamily:FF.sans,fontSize:16,color:theme.textSecondary}}> min</Text></Text>
      </View>
      <TouchableOpacity onPress={function(){haptic('light');bumpDuration(5);}} style={[z.stepBtn,{borderColor:theme.border}]}><Text style={[z.stepTx,{color:theme.text}]}>+</Text></TouchableOpacity>
    </View>
    <Caps color={theme.muted} style={{marginBottom:14,textAlign:'center'}}>Range: 5 to 240 min · Adjust by 5 min</Caps>
    <Caps style={{marginBottom:8}}>Note (optional)</Caps>
    <TextInput
      style={[z.inp,{backgroundColor:theme.surface,color:theme.text,borderColor:theme.border,minHeight:60,textAlignVertical:'top',marginBottom:12}]}
      value={note}
      onChangeText={function(v){setNote(v.slice(0,200));}}
      placeholder="Optional — what did you do?"
      placeholderTextColor={theme.muted}
      multiline={true}
      maxLength={200}
    />
    <DateField label="Date" value={selectedDate} onChange={setSelectedDate} maximumDate={new Date()}/>
    <View style={{flexDirection:'row',gap:10,marginTop:8}}>
      <View style={{flex:1}}><SecondaryButton full onPress={onClose}>Cancel</SecondaryButton></View>
      <View style={{flex:1.4}}><PrimaryButton full disabled={loading} onPress={save}>{loading?'Saving…':(editActivity?'Save changes':'Save activity')}</PrimaryButton></View>
    </View>
  </ModalSheet>);
}

// ═══════════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════════
// isInSilentHours — true if HH:MM "now" falls inside the [start, end] window. Handles
// midnight-wrapping windows (start > end means "from start tonight to end tomorrow").
function isInSilentHours(now,start,end){
  if(!start||!end)return false;
  var sp=String(start).split(':'),ep=String(end).split(':');
  var startMin=(Number(sp[0])||0)*60+(Number(sp[1])||0);
  var endMin=(Number(ep[0])||0)*60+(Number(ep[1])||0);
  var nowMin=now.getHours()*60+now.getMinutes();
  if(startMin===endMin)return false;
  if(startMin<endMin)return nowMin>=startMin&&nowMin<=endMin;
  return nowMin>=startMin||nowMin<=endMin; // wraps midnight
}

function HomeScreen(){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var navigation=useNavigation();
  var{familyId,familyName,members,transactions,meals,goals,wellness,todayNudge,openSettings,setQuickAction,userCreatedAt,userId,refreshTransactions,upsertTransactionLocal,dismissNudge,dismissedNudgeIds,waterTrackingEnabled,waterTargetLitres,refreshMeals,refreshWellness,refreshActivityFeed,refreshNudges,familyProteinToday,screenTargetHrs,silentHoursEnabled,silentHoursStart,silentHoursEnd}=useApp();
  // Session-only override — "Show full app anyway" lets the user bypass silent mode for
  // this app session. Resets on next launch (deliberate non-persistence — silent should
  // be the default unless explicitly opted out for this sitting).
  var[showFullAppOverride,setShowFullAppOverride]=useState(false);
  var perms=useFamilyPermissions();
  var[memberFilterId,setMemberFilterId]=useState(null);
  var[showTx,setShowTx]=useState(false);
  var[showQuickLog,setShowQuickLog]=useState(false);
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
  function jumpToReflectThisWeek(){
    setQuickAction&&setQuickAction({action:'focus_week',nonce:Date.now()});
    navigation.navigate('Reflect');
  }
  function jumpToReflectMonth(){
    setQuickAction&&setQuickAction({action:'focus_month',nonce:Date.now()});
    navigation.navigate('Reflect');
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
    var hasScreen=dayWell.some(function(w){return w.screenHrs!=null||w.screen_hrs!=null;});
    var missing=[];
    if(!hasTx)missing.push({key:'today-finance',label:'Capture an expense or income',tab:'Finance',action:'open_tx'});
    if(!hasBreakfast)missing.push({key:'today-breakfast',label:'Note breakfast',tab:'Wellness',action:'open_meal',mealType:'breakfast'});
    if(!hasLunch)missing.push({key:'today-lunch',label:'Note lunch',tab:'Wellness',action:'open_meal',mealType:'lunch'});
    if(!hasDinner)missing.push({key:'today-dinner',label:'Note dinner',tab:'Wellness',action:'open_meal',mealType:'dinner'});
    if(!hasScreen)missing.push({key:'today-screen',label:'Note screen time',tab:'Wellness',action:'open_screen'});
    setTodayStatus({loading:false,missing:missing});
  },[familyId,transactions,meals,wellness]);
  var now=new Date();
  // Chip-reactive scope: when a member is selected, all sections below the top cards
  // (stats strip, last-seven-days, latest, waiting-to-confirm) read from this scoped list.
  // Top cards (streak hero, 2x2 grid, "Did I hit my targets?") still read from the
  // unfiltered transactions/meals/wellness arrays — they're the family-level snapshot.
  function txMatchesMemberFilter(t){return !memberFilterId || (t.memberId||t.member_id)===memberFilterId;}
  var scopedTxs=memberFilterId?transactions.filter(txMatchesMemberFilter):transactions;
  var monthTxs=scopedTxs.filter(function(t){return isThisMonth(t.date);});
  var expenses=monthTxs.filter(function(t){return t.category!=='Income';}).reduce(function(s,t){return s+t.amount;},0);
  var today=isoDate(now);var todayMeals=meals.filter(function(m){return isoDate(m.date)===today;});
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
  var unconf=scopedTxs.filter(function(t){return!t.confirmed;});
  var filteredMember=memberFilterId?(members||[]).find(function(m){return m.id===memberFilterId;}):null;
  var filteredMemberName=filteredMember?(filteredMember.name||'this member').split(' ')[0]:null;
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
  var yAnyScreen=yWellness.some(function(w){return w.screenHrs!=null;});
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
    if(calcStreakCompletion(familyId,d3,meals,wellness))streak++;
    else break;
  }
  var bestDay=weeklyScores.slice().sort(function(a,b){return b.percent-a.percent;})[0]||weeklyScores[0];
  var worstDay=weeklyScores.slice().sort(function(a,b){return a.percent-b.percent;})[0]||weeklyScores[0];

  // Personal wins for the day — only positives of the individual user
  var meId=((members||[]).find(function(m){return m.userId===userId;})||{}).id;
  var myMealTypesToday={};
  (meals||[]).forEach(function(ml){
    if(isoDate(ml.date)!==today)return;
    if(meId&&(ml.memberId||ml.member_id)!==meId)return;
    myMealTypesToday[String(ml.mealTime||ml.meal_time||'').toLowerCase()]=true;
  });
  var allMealsLogged=!!(myMealTypesToday.breakfast&&myMealTypesToday.lunch&&myMealTypesToday.dinner);
  var myWellnessToday=(wellness||[]).find(function(w){return w.date===today&&(meId?(w.memberId||w.member_id)===meId:true);});
  var waterTargetMet=!!(myWellnessToday&&myWellnessToday.water_target_met===true);
  var screenLogged=!!(myWellnessToday&&Number(myWellnessToday.screenHrs||myWellnessToday.screen_hrs||0)>0);
  var todayDone=todaysCompletion.percent===100;
  var personalWins=[];
  if(todayDone){
    personalWins.push({key:'all',title:'Today is fully captured',sub:'Every entry in. Excellent rhythm.',bg:theme.primary,fg:'#fff',full:true});
  }else{
    if(allMealsLogged)personalWins.push({key:'meals',title:'All meals logged',sub:'Breakfast · Lunch · Dinner',bg:theme.primaryLight,fg:theme.primary});
    if(waterTargetMet)personalWins.push({key:'water',title:'Water target hit',sub:'Hydration ✓',bg:theme.primaryLight,fg:theme.primary});
    if(screenLogged)personalWins.push({key:'screen',title:'Screen time captured',sub:'Awareness ✓',bg:theme.accentLight,fg:theme.accent});
  }
  var streakSinceLabel=streak>0?addDays(now,-streak).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):null;

  // 2x2 grid data (Phase 2.1.B: Protein / Spent / Screen / Logged — Water replaced by Protein)
  var myProteinEntry=(familyProteinToday||[]).find(function(x){return x.member.id===meId;});
  var myProteinCurrent=myProteinEntry?Number(myProteinEntry.current)||0:0;
  var myProteinRegularTarget=(myProteinEntry&&myProteinEntry.targets&&Number(myProteinEntry.targets.regular))||0;
  var todayExpense=(transactions||[]).filter(function(t){return isoDate(t.date)===today&&t.category!=='Income';}).reduce(function(s,t){return s+Number(t.amount||0);},0);
  var todayTxCount=(transactions||[]).filter(function(t){return isoDate(t.date)===today;}).length;
  var todayScreen=myWellnessToday?Number(myWellnessToday.screenHrs||myWellnessToday.screen_hrs||0):0;
  function formatHrs(h){var hh=Math.floor(h);var mm=Math.round((h-hh)*60);return hh+'h '+(mm<10?'0':'')+mm+'m';}
  var todayItemsLogged=(transactions||[]).filter(function(t){return isoDate(t.date)===today;}).length+(meals||[]).filter(function(m){return isoDate(m.date)===today;}).length+(wellness||[]).filter(function(w){return w.date===today;}).length;
  var todayPending=(todayStatus&&todayStatus.missing)?todayStatus.missing.length:0;

  // Phase 2.1.E: end-of-day water prompt now lives in the Water row of "Did I hit my targets?"
  // Active after 6pm when myWellnessToday.water_target_met is still null/undefined.
  var hourNow=new Date().getHours();
  var needsWaterPrompt=hourNow>=18 && (!myWellnessToday || myWellnessToday.water_target_met==null);
  async function confirmWaterYes(){
    haptic('medium');
    try{
      var payload={family_id:familyId,user_id:userId,member_id:userId,date:today,water_target_met:true,water_target_litres:Number(waterTargetLitres||2.5),updated_at:new Date().toISOString()};
      await supabase.from('wellness').upsert(payload,{onConflict:'family_id,member_id,date'});
      await refreshWellness();
      await recordScore(familyId,userId,'water_target_hit',15);
      await bumpStreak(familyId,userId,'water_target');
    }catch(e){console.log('[WATER CONFIRM ERROR]',e);}
  }
  async function confirmWaterNo(){
    haptic('light');
    try{
      var payload={family_id:familyId,user_id:userId,member_id:userId,date:today,water_target_met:false,water_target_litres:Number(waterTargetLitres||2.5),updated_at:new Date().toISOString()};
      await supabase.from('wellness').upsert(payload,{onConflict:'family_id,member_id,date'});
      await refreshWellness();
    }catch(e){console.log('[WATER NO CONFIRM ERROR]',e);}
  }

  // "Did I hit my targets?" computed states
  var targetRows=[
    {key:'water',q:'Hit your water target ('+Number(waterTargetLitres||2.5).toFixed(1)+'L)?',state:myWellnessToday&&myWellnessToday.water_target_met===true?'yes':myWellnessToday&&myWellnessToday.water_target_met===false?'no':'unknown',info:{title:'Water target',body:'Marked Yes when you confirm at end of day that you hit your '+Number(waterTargetLitres||2.5).toFixed(1)+'L water target. The confirm prompt appears here after 6pm.'}},
    {key:'screen',q:'Stayed under '+(Number(screenTargetHrs)||2)+'h on screens?',state:myWellnessToday&&todayScreen>0?(todayScreen<=(Number(screenTargetHrs)||2)?'yes':'no'):'unknown',info:{title:'Screen time target',body:"Marked Yes when today's screen time is logged and stays at or under "+(Number(screenTargetHrs)||2)+" hours."}},
    {key:'meals',q:'Logged all 3 meals?',state:allMealsLogged?'yes':(Object.keys(myMealTypesToday).length>0?'no':'unknown'),info:{title:'Meals target',body:'Marked Yes when all 3 meals — breakfast, lunch, and dinner — are logged for today.'}},
  ];

  // ── Silent Hours guard ────────────────────────────────────────────────────
  // When inside the user's quiet window (and they haven't tapped "Show full app
  // anyway" this session), replace Home with a deliberately reduced screen.
  // Logging stays available — the moon screen IS the feature, not a wall.
  var inSilent=silentHoursEnabled&&isInSilentHours(new Date(),silentHoursStart,silentHoursEnd);
  if(inSilent&&!showFullAppOverride){
    return <View style={{flex:1,paddingTop:ins.top,backgroundColor:theme.bg}}>
      <AddTxModal visible={showTx||!!editTx} onClose={function(){setShowTx(false);setEditTx(null);}} editTx={editTx}/>
      <QuickLogSheet visible={showQuickLog} onClose={function(){setShowQuickLog(false);}}/>
      <View style={{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:32}}>
        <Text style={{fontSize:48,color:theme.textSecondary,marginBottom:24}} accessibilityLabel="Moon">🌙</Text>
        <Text style={{fontFamily:fontW(500),fontWeight:'500',fontSize:18,color:theme.text,textAlign:'center',marginBottom:10}}>We'll see you in the morning.</Text>
        <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,textAlign:'center',lineHeight:19,marginBottom:32}}>If something happened today you want to remember, the log buttons are still here.</Text>
        <View style={{flexDirection:'row',gap:12,alignSelf:'stretch'}}>
          <View style={{flex:1}}><SecondaryButton full onPress={function(){haptic('light');setQuickAction&&setQuickAction({action:'open_meal',mealType:'dinner',nonce:Date.now()});navigation.navigate('Wellness');}}>Log meal</SecondaryButton></View>
          <View style={{flex:1}}><SecondaryButton full onPress={function(){haptic('light');setShowQuickLog(true);}}>Log transaction</SecondaryButton></View>
        </View>
      </View>
      <TouchableOpacity onPress={function(){setShowFullAppOverride(true);}} style={{paddingVertical:14,alignItems:'center'}}>
        <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.textSecondary}}>Show full app anyway</Text>
      </TouchableOpacity>
    </View>;
  }

  return(<View style={[z.scr,{paddingTop:ins.top,backgroundColor:theme.bg}]}>
    <AddTxModal visible={showTx||!!editTx} onClose={function(){setShowTx(false);setEditTx(null);}} editTx={editTx}/>
    <QuickLogSheet visible={showQuickLog} onClose={function(){setShowQuickLog(false);}}/>
    <DayDetailModal visible={showDayDetail} date={dayDetailDate} onClose={function(){setShowDayDetail(false);}} onChangeDate={setDayDetailDate} onEditTransaction={function(t){setShowDayDetail(false);setEditTx(t);}} onAddTransaction={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_tx',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Finance');}} onEditMeal={function(m){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_meal',mealType:(m.mealTime||'lunch'),initialDate:isoDate(m.date),editMealId:m.id,nonce:Date.now()});navigation.navigate('Wellness');}} onAddMeal={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_meal',mealType:'lunch',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}} onAddWater={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_water',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}} onAddScreen={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_screen',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}}/>
    <ScrollView style={z.fl} contentContainerStyle={z.pad} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.primary} colors={[theme.primary]}/>}
    >
    {/* Header */}
    <View style={[z.hdr,{paddingTop:12}]}>
      <View style={{flex:1}}>
        <TouchableOpacity onPress={function(){haptic('light');jumpToReflectMonth();}} accessibilityRole="button">
          <Text style={[z.caps,{color:theme.muted,marginBottom:4}]}>{now.toLocaleString('en-IN',{month:'long',year:'numeric'})} {'›'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={function(){haptic('light');navigation.navigate('Family');}} accessibilityRole="button">
          <Text style={[z.famNm,{color:theme.text,fontSize:24}]} numberOfLines={1}>{familyName||'Your Family'}</Text>
        </TouchableOpacity>
      </View>
      <View style={[z.row,{marginRight:8}]}>
        {members.slice(0,4).map(function(m,i){return<TouchableOpacity key={m.id} onPress={function(){haptic('light');setQuickAction&&setQuickAction({action:'focus_member',memberName:m.name,nonce:Date.now()});navigation.navigate('Family');}} style={[z.avS,{backgroundColor:SLOTS[i%5].bg,marginLeft:i?-8:0,zIndex:4-i,borderColor:theme.background}]} accessibilityLabel={m.name}><Text style={[z.avSTx,{color:SLOTS[i%5].text}]}>{(m.name||'?')[0]}</Text></TouchableOpacity>;})}
      </View>
      <TouchableOpacity onPress={function(){haptic('light');openSettings();}} style={{padding:6}}>
        <Text style={{fontSize:22,color:theme.textSecondary}}>{'⚙'}</Text>
      </TouchableOpacity>
    </View>

    {/* Streak hero — primary olive, white-on-primary */}
    <View style={{borderRadius:24,backgroundColor:theme.primary,padding:22,marginTop:12}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
        <Caps color="rgba(255,255,255,0.7)">Your streak</Caps>
        <InfoIcon
          title="How streak is calculated"
          body="Your streak counts a day when all 3 meals (breakfast, lunch, dinner) and screen time are logged. Money entries don't count — they're optional, since not everyone in the family earns. Water is target-based, so it's tracked separately."
          color="rgba(255,255,255,0.7)"
        />
      </View>
      <View style={{flexDirection:'row',alignItems:'baseline',marginTop:8}}>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:56,letterSpacing:-2.2,color:'#fff',lineHeight:58}}>{streak||0}</Text>
        <Text style={{fontFamily:FF.sans,fontSize:18,fontWeight:'500',color:'rgba(255,255,255,0.75)',marginLeft:6}}>{(streak||0)===1?'day':'days'}</Text>
      </View>
      <Text style={{fontFamily:FF.sans,fontSize:13,color:'rgba(255,255,255,0.78)',marginTop:12,lineHeight:18}}>
        {streak>0
          ?'Streak running since '+streakSinceLabel+'. Keep it going.'
          :'A fresh start. Capture today and the streak begins.'}
      </Text>
    </View>

    {/* 2x2 grid: Protein / Spent / Screen / Logged — Phase 2.1.B replaced Water tile with Protein. */}
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:12}}>
      <View style={{width:'48%',backgroundColor:theme.surfaceElevated,borderRadius:20,padding:16,position:'relative'}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <Caps>Protein</Caps>
          <InfoIcon
            title="Protein target on Home"
            body="Shown here is your Regular protein target. If you're working out, the Active target is higher — see the Wellness tab for both."
          />
        </View>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:26,letterSpacing:-0.8,color:theme.text,marginTop:6}}>{myProteinCurrent}{myProteinRegularTarget>0?<Text style={{fontSize:14,fontWeight:'500',color:theme.textSecondary}}> / {myProteinRegularTarget}g</Text>:<Text style={{fontSize:14,fontWeight:'500',color:theme.textSecondary}}>g</Text>}</Text>
        {myProteinRegularTarget>0?<View style={{marginTop:8}}>
          <Progress value={Math.min((myProteinCurrent/myProteinRegularTarget)*100,100)}/>
        </View>:null}
      </View>
      <View style={{width:'48%',backgroundColor:theme.primaryLight,borderRadius:20,padding:16}}>
        <Caps color={theme.primary}>Spent</Caps>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:26,letterSpacing:-0.8,color:theme.primaryDeep,marginTop:6}}>₹{fmt(todayExpense)}</Text>
        <Caps color={theme.textSecondary} style={{marginTop:6}}>{todayTxCount} transaction{todayTxCount===1?'':'s'}</Caps>
      </View>
      <View style={{width:'48%',backgroundColor:theme.accentLight,borderRadius:20,padding:16}}>
        <Caps color={theme.accent}>Screen time</Caps>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:26,letterSpacing:-0.8,color:theme.accent,marginTop:6}}>{todayScreen>0?formatHrs(todayScreen):'—'}</Text>
        <Caps color={theme.textSecondary} style={{marginTop:6}}>today</Caps>
      </View>
      <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setDayDetailDate(new Date());setShowDayDetail(true);}} style={{width:'48%',backgroundColor:theme.surfaceElevated,borderRadius:20,padding:16}}>
        <Caps>Logged</Caps>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:26,letterSpacing:-0.8,color:theme.text,marginTop:6}}>{todayItemsLogged} <Text style={{fontSize:14,fontWeight:'500',color:theme.textSecondary}}>item{todayItemsLogged===1?'':'s'}</Text></Text>
        <Caps color={theme.textSecondary} style={{marginTop:6}}>{todayPending>0?todayPending+' still pending':'all caught up'}</Caps>
      </TouchableOpacity>
    </View>

    {/* Did I hit my targets? */}
    <Block style={{padding:14,marginTop:12}}>
      <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:18,letterSpacing:-0.4,color:theme.text,marginBottom:6}}>Did I hit my targets?</Text>
      {targetRows.map(function(row,i,arr){
        var unknown=row.state==='unknown';
        return <View key={row.key} style={{
          flexDirection:'row',justifyContent:'space-between',alignItems:'center',
          paddingVertical:10,
          borderBottomWidth:i<arr.length-1?StyleSheet.hairlineWidth:0,
          borderBottomColor:theme.border,
        }}>
          <View style={{flex:1,marginRight:8,flexDirection:'row',alignItems:'center'}}>
            <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.text}}>{row.q}</Text>
            {row.info?<InfoIcon title={row.info.title} body={row.info.body} style={{marginLeft:8}}/>:null}
          </View>
          {row.key==='water'&&needsWaterPrompt?<View style={{flexDirection:'row',gap:6}}>
            <TouchableOpacity activeOpacity={0.7} onPress={confirmWaterYes} style={{
              height:30,paddingHorizontal:14,borderRadius:9999,
              justifyContent:'center',alignItems:'center',
              backgroundColor:theme.primary,borderWidth:1.5,borderColor:theme.primary,
            }}>
              <Text style={{fontFamily:FF.sansSemi,fontSize:12,fontWeight:'600',color:'#fff'}}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={confirmWaterNo} style={{
              height:30,paddingHorizontal:14,borderRadius:9999,
              justifyContent:'center',alignItems:'center',
              backgroundColor:theme.surfaceElevated,borderWidth:1.5,borderColor:theme.border,
            }}>
              <Text style={{fontFamily:FF.sansSemi,fontSize:12,fontWeight:'600',color:theme.textSecondary}}>No</Text>
            </TouchableOpacity>
          </View>:<View style={{flexDirection:'row',gap:6}}>
            {['Yes','No'].map(function(opt){
              var sel=row.state===opt.toLowerCase();
              return <View key={opt} style={{
                height:30,paddingHorizontal:14,borderRadius:9999,
                justifyContent:'center',alignItems:'center',
                backgroundColor:sel?(opt==='Yes'?theme.primary:theme.surfaceElevated):'transparent',
                borderWidth:1.5,
                borderColor:sel?(opt==='Yes'?theme.primary:theme.border):theme.border,
                opacity:unknown?0.55:1,
              }}>
                <Text style={{fontFamily:FF.sansSemi,fontSize:12,fontWeight:'600',color:sel&&opt==='Yes'?'#fff':theme.textSecondary}}>{opt}</Text>
              </View>;
            })}
          </View>}
        </View>;
      })}
    </Block>

    {/* More details divider */}
    <View style={{flexDirection:'row',alignItems:'center',marginTop:24,marginBottom:14}}>
      <View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:theme.border}}/>
      <Caps color={theme.muted} style={{marginHorizontal:12}}>More details</Caps>
      <View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:theme.border}}/>
    </View>

    {/* Daily insight — the sentence is the first thing the eye lands on */}
    {visibleTodayNudge&&<TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');navigation.navigate('Reflect');}} style={[z.nudge,{marginTop:8,marginBottom:6,backgroundColor:theme.accentLight,borderLeftColor:theme.accent}]}>
      <View style={[z.row,{justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}]}>
        <Text style={[z.cap,{color:theme.accent,textTransform:'uppercase',letterSpacing:0.6,fontWeight:'700'}]}>{nudgeLabel}</Text>
        <TouchableOpacity onPress={function(){dismissNudge&&dismissNudge(visibleTodayNudge.id);}}><Text style={[z.cap,{color:theme.accent,fontWeight:'600'}]}>Dismiss</Text></TouchableOpacity>
      </View>
      <Text style={[z.nudgeTx,{color:theme.text,fontSize:15,lineHeight:22}]}>{visibleTodayNudge.nudge_text}</Text>
    </TouchableOpacity>}

    {/* When there is no nudge yet, show a quiet, sentence-first welcome line so the screen never opens with a number.
        Reactive to the member chip selection below — phrases the lens the rest of the screen is showing. */}
    {!visibleTodayNudge&&<View style={{marginTop:6,marginBottom:8,paddingHorizontal:4}}>
      <Text style={{fontSize:15,fontWeight:'500',color:theme.textSecondary,lineHeight:22}}>
        {memberFilterId
          ?(filteredMember&&filteredMember.userId===userId
              ?'Here is what today looks like for you.'
              :'Here is what today looks like for '+(filteredMemberName||'this member')+'.')
          :(members.length>1
              ?'Here is what your family looks like today.'
              :'Here is what today looks like for you and your family.')}
      </Text>
    </View>}

    {/* Member chip strip — drill into one member's data for sections below the top cards.
        Top cards (streak hero + 2x2 grid + targets card) intentionally stay aggregate.
        Permission gate: tier='member' can only pick "Whole family" or self; other taps alert. */}
    <MemberChipStrip
      members={members}
      selectedId={memberFilterId}
      onSelect={setMemberFilterId}
      gate={function(nextId){
        if(!nextId)return true; // Whole family always allowed
        if(perms.tier==='creator'||perms.tier==='co_admin')return true;
        if(nextId===perms.currentMemberId)return true;
        var target=(members||[]).find(function(m){return m.id===nextId;});
        var targetName=target?(target.name||'this member').split(' ')[0]:'this member';
        Alert.alert('No access',targetName+"'s spending is private. Ask a family admin if you need this.");
        return false;
      }}
    />

    {!todayStatus.loading&&isAllCaughtUp&&!memberFilterId&&<View style={[z.ok,{marginTop:10,backgroundColor:theme.primaryLight}]}><Text style={[z.okTx,{color:theme.primary}]}>Today is fully captured ✓</Text></View>}

    {/* Stats strip — every tile is now tappable */}
    <View style={[z.strip,{marginTop:10,marginBottom:16}]}>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');jumpToReflectThisWeek();}} style={[z.tile,{backgroundColor:theme.surfaceElevated}]}><Text style={[z.tileLbl,{color:theme.textSecondary}]}>Daily average</Text><Text style={[z.tileVal,{color:theme.text}]}>{'₹'}{fmt(avgDaily)}</Text></TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){if(topCat&&topCat!=='-'){haptic('light');jumpToFinanceCategory(topCat);}}} style={[z.tile,{backgroundColor:theme.surfaceElevated}]}><Text style={[z.tileLbl,{color:theme.textSecondary}]}>Most went to</Text><Text style={[z.tileVal,{color:theme.text}]} numberOfLines={1}>{topCat}</Text></TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');navigation.navigate('Family');}} style={[z.tile,{backgroundColor:theme.surfaceElevated}]}><Text style={[z.tileLbl,{color:theme.textSecondary}]}>In your family</Text><Text style={[z.tileVal,{color:theme.text}]}>{members.length}</Text></TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setQuickAction&&setQuickAction({action:'focus_goals',nonce:Date.now()});navigation.navigate('Finance');}} style={[z.tile,{backgroundColor:theme.surfaceElevated}]}><Text style={[z.tileLbl,{color:theme.textSecondary}]}>Goal progress</Text><Text style={[z.tileVal,{color:theme.text}]}>{goalsPct}%</Text></TouchableOpacity>
    </View>

    <Sec>How this week is going</Sec>
    <View style={[z.card,{backgroundColor:theme.card,borderColor:theme.border}]}>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');jumpToReflectThisWeek();}} style={[z.row,{justifyContent:'space-between',marginBottom:8}]}> 
        <Text style={[z.sub,{color:theme.textSecondary}]}>Today</Text>
        <Text style={[z.fv,{color:getCompletionColor(todaysCompletion.percent)}]}>{todaysCompletion.completed}/5 ({todaysCompletion.percent}%)</Text>
      </TouchableOpacity>
      <Bar pct={todaysCompletion.percent} color={getCompletionColor(todaysCompletion.percent)} h={8}/>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');jumpToReflectThisWeek();}} style={[z.row,{justifyContent:'space-between',marginTop:10,marginBottom:6}]}> 
        <Text style={[z.sub,{color:theme.textSecondary}]}>Weekly average</Text>
        <Text style={[z.fv,{color:theme.text}]}>{weeklyAvg}% {weeklyTrend===0?'':weeklyTrend>0?'↑':'↓'}{weeklyTrend===0?'':Math.abs(weeklyTrend)+'%'}</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');jumpToReflectThisWeek();}} style={[z.row,{justifyContent:'space-between',marginBottom:6}]}> 
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

    {/* Phase 2.1.G: Yesterday's pending moved here from above the stats strip — sits after weekly status, before unconfirmed entries. */}
    {showCatchup&&<View style={[z.nudge,{marginTop:14,backgroundColor:theme.accentLight,borderLeftColor:theme.accent}]}>
      <View style={[z.row,{justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}]}>
        <Text style={[z.txM,{color:theme.text,flex:1}]}>Yesterday's pending</Text>
        <TouchableOpacity onPress={function(){setCatchupDismissed(true);}}><Text style={[z.cap,{color:theme.accent,fontWeight:'600'}]}>Dismiss</Text></TouchableOpacity>
      </View>
      {catchup.map(function(c){return<TouchableOpacity key={c.key} style={[z.row,{paddingVertical:6}]} onPress={function(){runChecklistAction(c);}}><View style={[z.checkbox,{borderColor:theme.accent}]}/><Text style={[z.body,{color:theme.text,flex:1}]}>{c.label}</Text><Text style={[z.cap,{color:theme.accent,fontWeight:'600'}]}>Open</Text></TouchableOpacity>;})}
    </View>}

    {unconf.length>0&&<View><Sec>Waiting for you to confirm</Sec>{unconf.slice(0,5).map(function(t){return<SwipeableTxCard key={t.id} tx={t} onConfirm={function(){confirmTx(t.id);}} onEdit={function(){setEditTx(t);}}><View style={[z.card,{backgroundColor:theme.card,borderColor:theme.border}]}><View style={[z.row,{justifyContent:'space-between',marginBottom:8}]}><View style={{flex:1}}><Text style={[z.txM,{color:theme.text}]}>{t.merchant}</Text><Text style={[z.cap,{color:theme.muted}]}>{t.memberName||'Joint'}</Text></View><Text style={[z.txM,{color:theme.text}]}>{'₹'}{fmt(t.amount)}</Text></View><View style={[z.row,{justifyContent:'space-between'}]}><CategoryPill label={t.category||'Uncat'}/><View style={z.row}><TouchableOpacity onPress={function(){setEditTx(t);}} style={z.editBtn}><Text style={z.editTx}>{'✎'}</Text></TouchableOpacity><PrimaryButton onPress={function(){confirmTx(t.id);}}>Confirm</PrimaryButton></View></View></View></SwipeableTxCard>;})}<Text style={[z.cap,{textAlign:'center',marginTop:4,color:theme.muted}]}>Swipe right to confirm · Swipe left to edit</Text></View>}
    {/* PHASE 6 #6: 'Still pending today' moved to top of Home (above), this duplicate removed. */}
    <View style={{alignSelf:'flex-start',marginTop:16}}><PrimaryButton onPress={function(){setShowTx(true);}}>+ Capture an entry</PrimaryButton></View>
    <Sec>The last seven days</Sec><View style={[z.card,{backgroundColor:theme.card,borderColor:theme.border}]}><View style={z.barRow}>{weekSpend.map(function(amt,i){
      var dayOffset=6-i;
      var barDate=addDays(now,-dayOffset);
      return<TouchableOpacity key={i} activeOpacity={0.7} onPress={function(){haptic('light');openDayDetail(barDate);}} style={z.barC}><View style={[z.bar,{height:Math.max((amt/maxSp)*80,4),backgroundColor:theme.primary}]}/><Text style={[z.barL,{color:theme.muted}]}>{dayLabels[(now.getDay()-6+i+7)%7]}</Text></TouchableOpacity>;
    })}</View><Text style={[z.note,{color:theme.textSecondary}]}>Total: {'₹'}{fmt(weekSpend.reduce(function(a,b){return a+b;},0))}</Text></View>
    {scopedTxs.length>0&&<View><Sec>Latest</Sec>{scopedTxs.slice(0,5).map(function(t){return<TouchableOpacity key={t.id} style={[z.actR,{borderBottomColor:theme.border}]} onPress={function(){setEditTx(t);}}><View style={{flex:1}}><Text style={[z.actTx,{color:theme.text}]}>{t.memberName||'Joint'} {'₹'}{fmt(t.amount)} {t.category}</Text><Text style={[z.cap,{color:theme.muted}]}>{t.merchant}</Text></View><Text style={[z.cap,{color:theme.muted}]}>{'✎'}</Text></TouchableOpacity>;})}</View>}
    {scopedTxs.length===0&&<View style={[z.nudge,{marginTop:20,backgroundColor:theme.accentLight,borderLeftColor:theme.accent}]}><Text style={[z.nudgeTx,{color:theme.text}]}>{memberFilterId?'No entries captured for '+(filteredMemberName||'this member')+' yet.':'Nothing captured yet. The first entry is the hardest.'}</Text></View>}
    <View style={{height:32}}/></ScrollView>
    <TouchableOpacity
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Quick log a transaction"
      onPress={function(){haptic('light');setShowQuickLog(true);}}
      style={{
        position:'absolute',right:16,bottom:16,
        width:56,height:56,borderRadius:28,
        backgroundColor:theme.primary,
        alignItems:'center',justifyContent:'center',
        elevation:6,
        shadowColor:'#000',shadowOpacity:0.2,shadowRadius:8,shadowOffset:{width:0,height:4},
      }}
    >
      <Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:28,color:'#fff',lineHeight:30}}>+</Text>
    </TouchableOpacity>
    </View>);
}

// ═══════════════════════════════════════════════════════════════
// FINANCE SCREEN
// ═══════════════════════════════════════════════════════════════
function FinanceScreen(){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var navigation=useNavigation();
  var{familyId,familyName,members,userId,isAdmin,transactions,meals,wellness,goals,sharedGoals,recurringTransactions,recurringSubscriptions,transactionComments,quickAction,setQuickAction,refreshTransactions,upsertTransactionLocal,removeTransactionLocal,refreshRecurringTransactions,refreshRecurringSubscriptions,dismissRecurringSubscription,refreshSharedGoals,refreshSharedGoalContributions,refreshMeals,refreshWellness,logActivity,currentUserName}=useApp();
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
  var[memberFilterId,setMemberFilterId]=useState(null); // chip-strip filter for sections below the top cards
  var perms=useFamilyPermissions();
  // Phase 6 statement upload state — modals + filter pill + resume banner.
  var[showStatementUpload,setShowStatementUpload]=useState(false);
  var[reviewStatementId,setReviewStatementId]=useState(null);
  var[sourceFilter,setSourceFilter]=useState('all'); // 'all' | 'manual' | 'statement'
  var[pendingReviews,setPendingReviews]=useState([]); // statement_imports rows with status='review'
  var[resumeDismissed,setResumeDismissed]=useState(false);

  // Load pending reviews when the tab focuses or after a successful import. RLS
  // restricts to this user's rows automatically. We also bound by delete_after so
  // we don't show banners for rows the cleanup job will expire any moment.
  async function loadPendingReviews(){
    if(!userId)return;
    try{
      var r=await supabase.from('statement_imports')
        .select('id, bank_name, document_type, period_start, period_end, parsed_transaction_count, delete_after')
        .eq('user_id',userId)
        .eq('status','review')
        .gt('delete_after',new Date().toISOString())
        .order('created_at',{ascending:false});
      if(!r.error)setPendingReviews(r.data||[]);
    }catch(e){console.log('[FINANCE PENDING REVIEWS ERROR]',e);}
  }
  useEffect(function(){loadPendingReviews();},[userId]);
  useEffect(function(){refreshRecurringSubscriptions&&refreshRecurringSubscriptions();},[userId]);
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
        refreshRecurringSubscriptions&&refreshRecurringSubscriptions(),
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
  // Top-card scope (Saved this month / Earned / Spent) — always whole-family, per spec.
  // Cash + Transfer are excluded from spend totals: cash is extracted not consumed,
  // transfers are personal payments. They remain visible in the transaction list.
  var monthTxs=transactions.filter(function(t){return isInViewMonth(t.date);});
  var income=monthTxs.filter(function(t){return t.category==='Income';}).reduce(function(s,t){return s+t.amount;},0);
  var expenses=monthTxs.filter(function(t){return isSpendingCategory(t.category);}).reduce(function(s,t){return s+t.amount;},0);
  var savings=income-expenses;var savePct=income>0?Math.round((savings/income)*100):0;
  // Chip-reactive scope for "Where it went", "Recent", "These usually happen", search results.
  var scopedTxs=memberFilterId?transactions.filter(function(t){return (t.memberId||t.member_id)===memberFilterId;}):transactions;
  var scopedMonthTxs=scopedTxs.filter(function(t){return isInViewMonth(t.date);});
  var scopedExpenses=scopedMonthTxs.filter(function(t){return isSpendingCategory(t.category);}).reduce(function(s,t){return s+t.amount;},0);
  var catData={};categoryFilterOptions.forEach(function(c){catData[c]=0;});scopedMonthTxs.filter(function(t){return isSpendingCategory(t.category);}).forEach(function(t){catData[t.category]=(catData[t.category]||0)+t.amount;});
  var filteredMonthTxs=applyFilters(scopedMonthTxs).filter(function(t){
    // Phase 6 statement-source pill: 'manual' shows only rows without statement_import_id;
    // 'statement' shows only imported rows; 'all' is unfiltered.
    if(sourceFilter==='manual')return !t.statement_import_id;
    if(sourceFilter==='statement')return !!t.statement_import_id;
    return true;
  });
  var financeFilteredMember=memberFilterId?(members||[]).find(function(m){return m.id===memberFilterId;}):null;
  var financeFilteredMemberName=financeFilteredMember?(financeFilteredMember.name||'this member').split(' ')[0]:null;
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

  return(<View style={{flex:1,paddingTop:ins.top,backgroundColor:theme.bg}}>
    <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg}/>
    <AddTxModal visible={showTx||!!editTx} onClose={function(){setShowTx(false);setEditTx(null);}} editTx={editTx} initialDate={addTxDate}/>
    <TransactionCommentsModal visible={!!selectedTxForComments} onClose={function(){setSelectedTxForComments(null);}} transaction={selectedTxForComments}/>
    <UnifiedCalendarModal visible={showCalendar} onClose={function(){setShowCalendar(false);}} context="finance" selectedDate={calendarDate} onSelectDate={setCalendarDate} onOpenDayDetail={function(d){setCalendarDate(d);setDayDetailDate(d);setShowDayDetail(true);}}/>
    <DayDetailModal visible={showDayDetail} date={dayDetailDate} onClose={function(){setShowDayDetail(false);}} onChangeDate={setDayDetailDate} onEditTransaction={function(t){setShowDayDetail(false);setEditTx(t);}} onAddTransaction={function(d){setShowDayDetail(false);setAddTxDate(d);setShowTx(true);}} onAddMeal={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_meal',mealType:'lunch',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}} onAddWater={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_water',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}} onAddScreen={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_screen',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}}/>
    <AddGoalModal visible={showGoal} onClose={function(){setShowGoal(false);}} defaultGoalType="personal" defaultCategory={goalContext==='Wellness'?'Health':'Savings'} contextLabel={goalContext}/>{editGoal&&<EditGoalModal visible={true} onClose={function(){setEditGoal(null);}} goal={editGoal} familyId={familyId}/>}
    <SharedGoalModal visible={showSharedGoalModal} onClose={function(){setShowSharedGoalModal(false);setActiveSharedGoal(null);}} goal={activeSharedGoal}/> 
    <CategoryQuickPickModal visible={!!catPickTx} onClose={function(){setCatPickTx(null);}} transaction={catPickTx}/>
    <SharedGoalContributionModal visible={!!goalQuickAdd&&goalQuickAdd.kind==='shared'} onClose={function(){setGoalQuickAdd(null);}} goal={goalQuickAdd&&goalQuickAdd.kind==='shared'?goalQuickAdd.raw:null}/>
    <StatementUploadModal
      visible={showStatementUpload}
      onClose={function(){setShowStatementUpload(false);loadPendingReviews();}}
      onOpenReview={function(id){setShowStatementUpload(false);setReviewStatementId(id);loadPendingReviews();}}
    />
    <StatementReviewModal
      visible={!!reviewStatementId}
      statementImportId={reviewStatementId}
      onClose={function(){setReviewStatementId(null);loadPendingReviews();}}
      onImported={function(){loadPendingReviews();}}
    />
    <ModalSheet visible={showMonthPicker} title="Choose month" onClose={function(){setShowMonthPicker(false);}}>
      {(function(){
        var arr=[];for(var i=0;i<24;i++)arr.push(i);
        return arr.map(function(i){
          var d=new Date(now.getFullYear(),now.getMonth()-i,1);
          var sel=d.getMonth()===viewMonth.getMonth()&&d.getFullYear()===viewMonth.getFullYear();
          return <TouchableOpacity key={'m'+i} onPress={function(){haptic('light');setViewMonth(d);setShowMonthPicker(false);}} style={{
            paddingVertical:12,paddingHorizontal:14,marginBottom:6,
            backgroundColor:sel?theme.primaryLight:theme.surface,
            borderRadius:14,
            borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,
          }}>
            <Text style={{fontFamily:sel?FF.sansSemi:FF.sans,fontSize:14,color:sel?theme.primary:theme.text}}>{d.toLocaleString('en-IN',{month:'long',year:'numeric'})}</Text>
          </TouchableOpacity>;
        });
      })()}
    </ModalSheet>}

    <ModalSheet visible={showFilters} title="Filters" onClose={function(){setShowFilters(false);}}>
      <Inp label="From date (YYYY-MM-DD)" value={filters.from} onChangeText={function(v){setFilters(Object.assign({},filters,{from:v}));}} placeholder="2026-04-01"/>
      <Inp label="To date (YYYY-MM-DD)" value={filters.to} onChangeText={function(v){setFilters(Object.assign({},filters,{to:v}));}} placeholder="2026-04-30"/>
      <Text style={[z.inpLabel,{color:theme.textSecondary}]}>Type</Text>
      <View style={{flexDirection:'row',gap:8,marginBottom:12}}>{['all','income','expense'].map(function(tp){
        var sel=filters.type===tp;
        return <TouchableOpacity key={tp} onPress={function(){setFilters(Object.assign({},filters,{type:tp}));}} style={{
          height:34,paddingHorizontal:12,borderRadius:9999,
          justifyContent:'center',alignItems:'center',
          backgroundColor:sel?theme.primaryLight:theme.surface,
          borderWidth:StyleSheet.hairlineWidth,borderColor:sel?theme.primary:theme.border,
        }}>
          <Text style={{fontFamily:sel?FF.sansSemi:FF.sans,fontSize:12,color:sel?theme.primary:theme.textSecondary,textTransform:'capitalize'}}>{tp}</Text>
        </TouchableOpacity>;
      })}</View>
      <Text style={[z.inpLabel,{color:theme.textSecondary}]}>Category</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12}}>
        <TouchableOpacity onPress={function(){setFilters(Object.assign({},filters,{category:''}));}} style={{
          height:34,paddingHorizontal:12,borderRadius:9999,
          justifyContent:'center',alignItems:'center',
          backgroundColor:!filters.category?theme.primaryLight:theme.surface,
          borderWidth:StyleSheet.hairlineWidth,borderColor:!filters.category?theme.primary:theme.border,
        }}>
          <Text style={{fontFamily:!filters.category?FF.sansSemi:FF.sans,fontSize:12,color:!filters.category?theme.primary:theme.textSecondary}}>All</Text>
        </TouchableOpacity>
        {categoryFilterOptions.map(function(c){
          var sel=filters.category===c;
          return <TouchableOpacity key={c} onPress={function(){setFilters(Object.assign({},filters,{category:c}));}} style={{
            height:34,paddingHorizontal:12,borderRadius:9999,
            justifyContent:'center',alignItems:'center',
            backgroundColor:sel?theme.primaryLight:theme.surface,
            borderWidth:StyleSheet.hairlineWidth,borderColor:sel?theme.primary:theme.border,
          }}>
            <Text style={{fontFamily:sel?FF.sansSemi:FF.sans,fontSize:12,color:sel?theme.primary:theme.textSecondary}}>{c}</Text>
          </TouchableOpacity>;
        })}
      </View>
      <View style={{flexDirection:'row',gap:8}}>
        <View style={{flex:1}}><Inp label="Min amount" value={filters.min} onChangeText={function(v){setFilters(Object.assign({},filters,{min:v}));}} keyboardType="numeric"/></View>
        <View style={{flex:1}}><Inp label="Max amount" value={filters.max} onChangeText={function(v){setFilters(Object.assign({},filters,{max:v}));}} keyboardType="numeric"/></View>
      </View>
      <View style={{flexDirection:'row',gap:10,marginTop:8}}>
        <View style={{flex:1}}><SecondaryButton full onPress={function(){setFilters({from:'',to:'',category:'',type:'all',min:'',max:''});}}>Clear all</SecondaryButton></View>
        <View style={{flex:1}}><PrimaryButton full onPress={function(){setShowFilters(false);}}>Apply</PrimaryButton></View>
      </View>
    </ModalSheet>}

    <ScrollView style={z.fl} contentContainerStyle={z.pad} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.primary} colors={[theme.primary]}/>}
    >
    {/* Header */}
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',paddingTop:8,marginBottom:14}}>
      <View style={{flex:1,marginRight:12}}>
        <TouchableOpacity onPress={function(){haptic('light');setShowMonthPicker(true);}} accessibilityRole="button">
          <Caps>{viewMonth.toLocaleString('en-IN',{month:'long',year:'numeric'})} ›</Caps>
        </TouchableOpacity>
        <Text style={{fontFamily:FF.serif,fontSize:30,letterSpacing:-0.8,color:theme.text,marginTop:6}}>Finance</Text>
      </View>
      <TouchableOpacity onPress={function(){setShowCalendar(true);}} style={{width:40,height:40,borderRadius:9999,backgroundColor:theme.surfaceElevated,alignItems:'center',justifyContent:'center'}}>
        <CalendarIcon size={20} color={theme.text}/>
      </TouchableOpacity>
    </View>

    {/* Saved this month — primary hero */}
    <Block bg={theme.primary} style={{padding:22}}>
      <Caps color="rgba(255,255,255,0.7)">Saved this month</Caps>
      <View style={{flexDirection:'row',alignItems:'baseline',marginTop:6}}>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:22,color:'#fff',opacity:0.85}}>₹</Text>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:52,letterSpacing:-2,color:'#fff',lineHeight:54}}>{fmt(Math.max(savings,0))}</Text>
      </View>
      <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:14}}>
        <Text style={{fontFamily:FF.sans,fontSize:12,color:'rgba(255,255,255,0.85)'}}>{income>0?savePct+'% of earnings':'Add income to see savings rate'}</Text>
        <Text style={{fontFamily:FF.sans,fontSize:12,color:'rgba(255,255,255,0.85)'}}>{viewMonth.toLocaleString('en-IN',{month:'short'})}</Text>
      </View>
    </Block>

    {/* 2-up: Earned / Spent */}
    <View style={{flexDirection:'row',gap:10,marginTop:10}}>
      <View style={{flex:1,backgroundColor:theme.surfaceElevated,borderRadius:20,padding:16}}>
        <Caps>Earned</Caps>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:22,letterSpacing:-0.7,color:theme.text,marginTop:6}}>₹{fmt(income)}</Text>
      </View>
      <View style={{flex:1,backgroundColor:theme.accentLight,borderRadius:20,padding:16}}>
        <Caps color={theme.accent}>Spent</Caps>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:22,letterSpacing:-0.7,color:theme.accent,marginTop:6}}>₹{fmt(expenses)}</Text>
      </View>
    </View>

    {/* Phase 2.2.D: condensed goals strip — top 3 by progress descending. Full list still lives below in "What you're building toward". */}
    {(function(){
      var allGoals=[].concat(
        (financeGoals||[]).map(function(g){var t=Number(g.target||0);return{kind:'personal',id:g.id,name:g.name,current:Number(g.current||0),target:t,pct:t>0?(Number(g.current||0)/t)*100:0,raw:g};}),
        (financeSharedGoals||[]).map(function(g){var t=Number(g.target_amount||0);return{kind:'shared',id:g.id,name:g.goal_name,current:Number(g.current_amount||0),target:t,pct:t>0?(Number(g.current_amount||0)/t)*100:0,raw:g};})
      );
      if(allGoals.length===0)return <Caps color={theme.muted} style={{marginTop:14}}>No money goals yet — start one below.</Caps>;
      var top3=allGoals.slice().sort(function(a,b){return b.pct-a.pct;}).slice(0,3);
      return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:12}} contentContainerStyle={{gap:10,paddingRight:18}}>
        {top3.map(function(g){
          var pct=Math.min(Math.round(g.pct),100);
          var fillColor=g.kind==='shared'?theme.accent:theme.primary;
          return <TouchableOpacity key={g.kind+'-'+g.id} activeOpacity={0.85} onPress={function(){haptic('light');if(g.kind==='personal'){setEditGoal(g.raw);}else{setActiveSharedGoal(g.raw);setShowSharedGoalModal(true);}}} style={{
            width:140,padding:12,borderRadius:16,
            backgroundColor:theme.surface,
            borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,
          }}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={{fontFamily:FF.sansSemi,fontSize:12,fontWeight:'600',color:theme.text}}>{g.name}</Text>
            <View style={{height:4,borderRadius:9999,backgroundColor:theme.surfaceElevated,marginTop:8,overflow:'hidden'}}>
              <View style={{width:pct+'%',height:'100%',backgroundColor:fillColor}}/>
            </View>
            <Text style={{fontFamily:FF.sansBold,fontSize:14,fontWeight:'700',color:theme.text,marginTop:6}}>{pct}%</Text>
          </TouchableOpacity>;
        })}
      </ScrollView>;
    })()}

    {/* Member chip strip — drill into one member's finance below the top hero. Top cards stay aggregate.
        Permission gate: tier='member' can only pick "Whole family" or self; other taps alert "No access". */}
    <View style={{marginTop:14}}>
      <MemberChipStrip
        members={members}
        selectedId={memberFilterId}
        onSelect={setMemberFilterId}
        gate={function(nextId){
          if(!nextId)return true;
          if(perms.tier==='creator'||perms.tier==='co_admin')return true;
          if(nextId===perms.currentMemberId)return true;
          var target=(members||[]).find(function(m){return m.id===nextId;});
          var targetName=target?(target.name||'this member').split(' ')[0]:'this member';
          Alert.alert('No access',targetName+"'s spending is private. Ask a family admin if you need this.");
          return false;
        }}
      />
    </View>

    {/* Where it went — all categories sorted, tappable to filter (Phase 2.2.B) */}
    <Block style={{padding:16,marginTop:12}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:18,letterSpacing:-0.4,color:theme.text}}>{memberFilterId?(financeFilteredMemberName||'Member')+'’s spending':'Where it went'}</Text>
        <Caps color={theme.muted}>Tap to filter</Caps>
      </View>
      {(function(){
        var sorted=Object.keys(catData).map(function(c){return{cat:c,amt:catData[c]||0};}).filter(function(o){return o.amt>0;}).sort(function(a,b){return b.amt-a.amt;});
        if(sorted.length===0)return <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted}}>No spending yet this month.</Text>;
        return sorted.map(function(row,i){
          var pct=scopedExpenses>0?Math.round((row.amt/scopedExpenses)*100):0;
          var active=filters.category===row.cat;
          return <TouchableOpacity key={row.cat} activeOpacity={0.7} onPress={function(){haptic('light');setFilters(Object.assign({},filters,{category:row.cat}));}} style={{marginBottom:i<sorted.length-1?12:0,opacity:active?1:1}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6,alignItems:'center'}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:6,flex:1}}>
                <Text style={{fontFamily:active?FF.sansSemi:FF.sans,fontSize:13,fontWeight:active?'600':'500',color:active?theme.primary:theme.text}}>{row.cat}</Text>
                {active?<Text style={{fontFamily:FF.sansBold,fontSize:11,color:theme.primary}}>•</Text>:null}
                <Text style={{fontFamily:FF.sans,fontSize:11,color:theme.muted}}>{pct}%</Text>
              </View>
              <Text style={{fontFamily:FF.sansSemi,fontSize:13,fontWeight:'600',color:theme.text}}>₹{fmt(row.amt)}</Text>
            </View>
            <Progress value={pct}/>
          </TouchableOpacity>;
        });
      })()}
    </Block>

    {/* Phase 6 — "Catch me up" entry: opens StatementUploadModal. Sits above Recent
        as a secondary CTA — primary stays the Capture button below the list. */}
    <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setShowStatementUpload(true);}} style={{
      marginTop:12,padding:14,borderRadius:14,
      backgroundColor:theme.surface,
      borderWidth:1,borderColor:theme.primary,
      flexDirection:'row',alignItems:'center',gap:12,
    }}>
      <Text style={{fontSize:22}}>📄</Text>
      <View style={{flex:1}}>
        <Text style={{fontFamily:fontW(600),fontWeight:'600',fontSize:14,color:theme.text}}>Catch me up — upload last statement</Text>
        <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.textSecondary,marginTop:2}}>Pull a month of transactions from your bank or credit card PDF.</Text>
      </View>
      <Text style={{fontFamily:fontW(500),fontSize:14,color:theme.primary}}>›</Text>
    </TouchableOpacity>

    {/* Resume banner — surfaces unfinished imports from the last 24h. */}
    {pendingReviews.length>0&&!resumeDismissed?<View style={{
      marginTop:10,padding:12,borderRadius:14,
      backgroundColor:theme.accentLight,
      borderLeftWidth:3,borderLeftColor:theme.accent,
      flexDirection:'row',alignItems:'center',gap:10,
    }}>
      <View style={{flex:1}}>
        <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setReviewStatementId(pendingReviews[0].id);}}>
          <Text style={{fontFamily:fontW(500),fontSize:13,color:theme.text,lineHeight:18}}>You have {pendingReviews.length} unfinished review{pendingReviews.length===1?'':'s'} from your last upload. Continue?</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={function(){setResumeDismissed(true);}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
        <Text style={{fontFamily:fontW(500),fontSize:18,color:theme.accent}}>×</Text>
      </TouchableOpacity>
    </View>:null}

    {/* Source filter pills — All / Manual / From statements. */}
    <View style={{flexDirection:'row',gap:6,marginTop:12,marginBottom:6}}>
      {[['all','All'],['manual','Manual'],['statement','From statements']].map(function(pair){
        var sel=sourceFilter===pair[0];
        return <TouchableOpacity key={'srcf_'+pair[0]} onPress={function(){haptic('light');setSourceFilter(pair[0]);}} style={{
          paddingHorizontal:12,height:32,borderRadius:9999,
          alignItems:'center',justifyContent:'center',
          backgroundColor:sel?theme.primary:'transparent',
          borderWidth:sel?0:1,borderColor:theme.border,
        }}><Text style={{fontFamily:fontW(500),fontSize:12,color:sel?'#fff':theme.textSecondary}}>{pair[1]}</Text></TouchableOpacity>;
      })}
    </View>

    {/* Recent transactions — top 5 */}
    <Block style={{padding:0,marginTop:6,overflow:'hidden'}}>
      <View style={{paddingHorizontal:16,paddingTop:14,paddingBottom:8,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:18,letterSpacing:-0.4,color:theme.text}}>Recent</Text>
        <Caps color={theme.primary}>{filteredMonthTxs.length} this month</Caps>
      </View>
      {filteredMonthTxs.slice(0,5).map(function(t){
        var isInc=t.category==='Income';
        var isCash=t.category==='Cash';
        var isXfer=t.category==='Transfer';
        var isNonSpend=isCash||isXfer;
        var memberObj=(members||[]).find(function(m){return m.id===t.memberId;});
        var slotIdx=memberObj?(members||[]).indexOf(memberObj):0;
        var slot=SLOTS[slotIdx%5]||SLOTS[0];
        var cc=CATS[t.category]||CATS.Uncat;
        return <View key={t.id} style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:12,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:theme.border}}>
          <Avatar name={t.memberName||'?'} color={slot.bg} size={32}/>
          <View style={{flex:1,minWidth:0}}>
            <View style={{flexDirection:'row',alignItems:'baseline',gap:6,flexWrap:'wrap'}}>
              <Text numberOfLines={1} style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.text,flexShrink:1}}>{t.merchant}</Text>
              {/* Non-spend tag: signals the row exists for completeness but isn't part of "spending". */}
              {isCash?<Text style={{fontFamily:FF.sans,fontSize:10,fontStyle:'italic',color:theme.textSecondary}}>(cash)</Text>:null}
              {isXfer?<Text style={{fontFamily:FF.sans,fontSize:10,fontStyle:'italic',color:theme.textSecondary}}>(transfer)</Text>:null}
              {t.statement_import_id?<Text style={{fontFamily:FF.sans,fontSize:10,fontStyle:'italic',color:theme.textSecondary}}>from statement</Text>:null}
            </View>
            <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:4}}>
              <Pill bg={cc.bg} fg={cc.text}>{t.category||'Uncat'}</Pill>
              <Caps color={theme.muted}>{displayDate(t.date)}</Caps>
            </View>
          </View>
          <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:14,letterSpacing:-0.2,color:isInc?theme.primary:(isNonSpend?theme.textSecondary:theme.text)}}>
            {isInc?'+':'−'}₹{fmt(Math.abs(t.amount))}
          </Text>
        </View>;
      })}
      {filteredMonthTxs.length===0&&<View style={{paddingHorizontal:16,paddingVertical:14,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:theme.border}}>
        <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted}}>No entries yet. Capture your first below.</Text>
      </View>}
    </Block>

    {/* Capture entry CTA */}
    <View style={{marginTop:14}}>
      <PrimaryButton full onPress={function(){setShowTx(true);}}>+ Capture expense or income</PrimaryButton>
    </View>

    {income===0&&<Block bg={theme.accentLight} style={{marginTop:10,borderLeftWidth:3,borderLeftColor:theme.accent,borderRadius:16,padding:14}}>
      <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.text,lineHeight:20}}>Add what you earned first to see what your family saved.</Text>
    </Block>}

    {/* More details divider */}
    <View style={{flexDirection:'row',alignItems:'center',marginTop:24,marginBottom:14}}>
      <View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:theme.border}}/>
      <Caps color={theme.muted} style={{marginHorizontal:12}}>More details</Caps>
      <View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:theme.border}}/>
    </View>

    <View style={{flexDirection:'row',gap:8,marginBottom:8}}>
      <View style={{flex:1}}><SecondaryButton full onPress={function(){setShowFilters(true);}}>Filters</SecondaryButton></View>
    </View>
    {unconfirmedRecurringTx.length>0&&<View style={[z.nudge,{marginTop:10,backgroundColor:theme.accentLight,borderLeftColor:theme.accent}]}> 
      <Text style={[z.txM,{color:theme.text,marginBottom:6}]}>These usually happen — confirm if they did</Text>
      {unconfirmedRecurringTx.slice(0,5).map(function(t){return <View key={t.id} style={[z.row,{justifyContent:'space-between',alignItems:'center',marginBottom:6}]}> 
        <View style={{flex:1,paddingRight:8}}><Text style={[z.body,{color:theme.text}]}>{t.merchant}</Text><Text style={[z.cap,{color:theme.muted}]}>{displayDate(t.date)} · {'₹'}{fmt(t.amount)}</Text></View>
        <View style={z.row}><View style={{marginRight:6}}><SecondaryButton onPress={function(){setEditTx(t);}} style={{height:32,paddingHorizontal:10}}>Edit</SecondaryButton></View><PrimaryButton onPress={function(){confirmTransaction(t);}} style={{height:32,paddingHorizontal:10}}>Confirm</PrimaryButton></View>
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
      else if(f==='Min ₹'+filters.min)nextFilters.min='';
      else if(f==='Max ₹'+filters.max)nextFilters.max='';
      else if(f==='Search: '+debouncedSearch.trim()){setSearchText('');setDebouncedSearch('');return;}
      setFilters(nextFilters);
    }} style={z.filterChip}><Text style={z.filterChipTx}>{f} ×</Text></TouchableOpacity>;})}</View>}
    <Text style={[z.cap,{marginBottom:8}]}>Showing {filteredMonthTxs.length} of {monthTxs.length} entries</Text>

    <Sec>This month’s entries</Sec>{filteredMonthTxs.slice(0,25).map(function(t){var commentCount=(transactionComments||[]).filter(function(c){return c.transaction_id===t.id;}).length;return<View key={t.id} style={z.txRow}><TouchableOpacity style={{flex:1}} onPress={function(){if(canModifyMemberData(isAdmin,members,userId,t.memberId)){setEditTx(t);} else Alert.alert('Read only','Only admin can edit other member entries.');}}><Text style={[z.body,{flex:1}]}>{t.merchant}</Text><Text style={[z.cap,{color:theme.muted}]}>{displayDate(t.date)} · {t.memberName||'Joint'}</Text></TouchableOpacity><Text style={[z.fv,{marginRight:8}]}>{'₹'}{fmt(t.amount)}</Text>{t.is_family_spending&&<Text style={[z.cap,{color:'#0F6E56',marginRight:6}]}>👨‍👩‍👧 Family</Text>}<TouchableOpacity onPress={function(){if(canModifyMemberData(isAdmin,members,userId,t.memberId)){haptic('light');setCatPickTx(t);} else Alert.alert('Read only','Only admin can change other member entries.');}}><CategoryPill label={t.category||'Uncat'}/></TouchableOpacity><TouchableOpacity onPress={function(){setSelectedTxForComments(t);}} style={z.editBtn}><Text style={z.editTx}>💬</Text>{commentCount>0&&<View style={z.commentCountBadge}><Text style={z.commentCountTx}>{commentCount}</Text></View>}</TouchableOpacity><TouchableOpacity onPress={function(){if(canModifyMemberData(isAdmin,members,userId,t.memberId)){setEditTx(t);} else Alert.alert('Read only','Only admin can edit other member entries.');}} style={z.editBtn}><Text style={z.editTx}>✎</Text></TouchableOpacity><TouchableOpacity onPress={function(){deleteTx(t);}} style={z.editBtn}><Text style={[z.editTx,{color:'#E24B4A'}]}>🗑</Text></TouchableOpacity></View>;})}
    {filteredMonthTxs.length===0&&<Text style={[z.cap,{color:theme.muted}]}>Nothing matches those filters.</Text>}
    <Sec>What you’re building toward</Sec>{[].concat((financeGoals||[]).map(function(g){var gt=(g.goal_type||((g.is_shared||g.goal_scope==='shared')?'shared':'personal'));return{kind:gt==='shared'?'shared':'personal',id:g.id,name:g.name,current:Number(g.current||0),target:Number(g.target||0),category:g.category||'General',raw:g,source:'goals'};}),(financeSharedGoals||[]).map(function(g){return{kind:'shared',id:g.id,name:g.goal_name,current:Number(g.current_amount||0),target:Number(g.target_amount||0),category:g.category||'General',raw:g,source:'shared_goals'};})).map(function(g){var pct=g.target>0?Math.round((g.current/g.target)*100):0;return<TouchableOpacity key={g.kind+'-'+g.source+'-'+g.id} style={[z.card,{backgroundColor:theme.card,borderColor:theme.border,marginBottom:8}]} onPress={function(){if(g.kind==='personal'){setEditGoal(g.raw);}else{setActiveSharedGoal(g.raw);setShowSharedGoalModal(true);}}} onLongPress={function(){if(g.kind==='shared'){haptic('medium');setGoalQuickAdd(g);}}} delayLongPress={350}><View style={[z.row,{justifyContent:'space-between',alignItems:'center'}]}><View style={{flex:1,paddingRight:8}}><View style={[z.row,{alignItems:'center',flexWrap:'wrap'}]}><Text style={[z.txM,{color:theme.text}]}>{g.name}</Text>{g.kind==='shared'&&<View style={z.goalFamilyBadge}><Text style={z.goalFamilyBadgeTx}>Family</Text></View>}{g.kind==='personal'&&<View style={[z.goalFamilyBadge,{backgroundColor:'#F2F2EE'}]}><Text style={[z.goalFamilyBadgeTx,{color:'#555'}]}>Personal</Text></View>}</View><Text style={[z.cap,{marginTop:4}]}>{g.category||'General'}</Text></View><Text style={[z.fv,{color:g.kind==='shared'?'#0F6E56':'#BA7517'}]}>{Math.min(pct,999)}%</Text></View><Text style={[z.cap,{marginVertical:6}]}>{fmt(g.current)} / {fmt(g.target)} progress</Text><Bar pct={Math.min(pct,100)} color={g.kind==='shared'?'#0F6E56':'#EF9F27'}/><Text style={[z.cap,{marginTop:4}]}>{g.kind==='shared'?'Tap to edit · Long-press to add a contribution':'Tap to edit goal'}</Text></TouchableOpacity>;})}
    {((financeGoals||[]).length===0&&(financeSharedGoals||[]).length===0)&&<Text style={[z.cap,{color:theme.muted}]}>No money goals yet. The first one starts below.</Text>}
    <View style={{alignSelf:'flex-start'}}><PrimaryButton onPress={function(){setGoalContext('Finance');setShowGoal(true);}}>+ New money goal</PrimaryButton></View>

    {(recurringSubscriptions||[]).length>0?<View>
      <Sec>Monthly recurring</Sec>
      <Text style={[z.cap,{color:theme.muted,marginBottom:8}]}>We watch for monthly outflows that look like subscriptions. Tap 'Not recurring' if we got it wrong.</Text>
      {(recurringSubscriptions||[]).map(function(s){
        var d=Number(s.median_interval_days||30);
        var freq=d<=10?'weekly':d<=20?'biweekly':d<=45?'monthly':d<=120?'quarterly':'yearly';
        return <View key={s.id} style={[z.card,{backgroundColor:theme.card,borderColor:theme.border,marginBottom:8}]}>
          <View style={[z.row,{justifyContent:'space-between'}]}>
            <Text style={[z.txM,{color:theme.text,flex:1,paddingRight:8}]}>{s.display_name}</Text>
            <Text style={[z.fv,{color:theme.text}]}>{'₹'}{fmt(s.median_amount||0)}</Text>
          </View>
          <Text style={[z.cap,{color:theme.muted}]}>{freq} · seen {s.occurrence_count||0} times · confidence {Math.round((s.confidence||0)*100)}%</Text>
          <TouchableOpacity style={{marginTop:8,alignSelf:'flex-start'}} onPress={function(){dismissRecurringSubscription&&dismissRecurringSubscription(s.id);}}><Text style={[z.cap,{color:'#E24B4A',fontWeight:'500'}]}>Not recurring</Text></TouchableOpacity>
        </View>;
      })}
    </View>:<Text style={[z.cap,{color:theme.muted}]}>No recurring subscriptions detected yet. We watch your spending patterns over a few months and surface what looks like monthly outflows here.</Text>}

    <Sec>Repeating entries</Sec>
    {(recurringTransactions||[]).map(function(r){
      var days=Math.floor((startOfDay(r.next_due_date)-startOfDay(new Date()))/86400000);
      var dueSoon=days>=0&&days<=7;
      return <TouchableOpacity key={r.id} activeOpacity={0.7} onPress={function(){
        // F19: tap row → open the related transaction edit if one exists; otherwise open new tx prefilled with the recurring info
        var related=(transactions||[]).find(function(t){return t.recurring_transaction_id===r.id;});
        if(related){setEditTx(related);}
        else{
          var stub={id:null,merchant:r.description,amount:r.amount,category:r.category||'',date:r.next_due_date,recurring_transaction_id:r.id};
          setEditTx(stub);
        }
      }} style={[z.card,{backgroundColor:theme.card,borderColor:theme.border,marginBottom:8,borderColor:dueSoon?'#BA7517':'#E0E0DB'}]}> 
      <View style={[z.row,{justifyContent:'space-between'}]}><Text style={[z.txM,{color:theme.text}]}>{r.description}</Text><Text style={[z.fv,{color:theme.text}]}>₹{fmt(r.amount)}</Text></View>
      <Text style={[z.cap,{color:theme.muted}]}>{r.transaction_type} · {r.frequency} · Next due {displayDate(r.next_due_date)}</Text>
      {dueSoon&&<Text style={[z.cap,{color:'#BA7517',marginTop:4,fontWeight:'500'}]}>Due in {days} day{days===1?'':'s'}</Text>}
      <TouchableOpacity style={{marginTop:8,alignSelf:'flex-start'}} onPress={function(){deactivateRecurring(r);}}><Text style={[z.cap,{color:'#E24B4A',fontWeight:'500'}]}>Disable</Text></TouchableOpacity>
    </TouchableOpacity>;})}
    {(!recurringTransactions||recurringTransactions.length===0)&&<Text style={[z.cap,{color:theme.muted}]}>No recurring entries yet. Enable it when adding a transaction.</Text>}
    <View style={{height:32}}/></ScrollView></View>);
}

// ═══════════════════════════════════════════════════════════════
// WELLNESS SCREEN
// ═══════════════════════════════════════════════════════════════
function WellnessScreen(){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var navigation=useNavigation();
  var{familyId,members,userId,isAdmin,meals,wellness,goals,memberProfiles,userProfile,quickAction,setQuickAction,refreshMeals,refreshWellness,refreshTransactions,removeMealLocal,removeWellnessLocal,logActivity,currentUserName,waterTrackingEnabled,waterTargetLitres,setWaterTargetLitres,scores,streaks,transactions,familyProteinToday,screenTargetHrs,setScreenTargetHrs,screenTimeAutoEnabled,setScreenTimeAutoEnabled,requestScreenTimePermission,activities,deleteActivity}=useApp();
  var[showMeal,setShowMeal]=useState(false);
  var[editMeal,setEditMeal]=useState(null); // B2
  var[showWater,setShowWater]=useState(false); // B3
  var[showScreen,setShowScreen]=useState(false); // B3
  var[showSleep,setShowSleep]=useState(false); // Part C: sleep logging modal
  var[showActivity,setShowActivity]=useState(false); // Phase B3
  var[editActivity,setEditActivity]=useState(null); // Phase B3
  var[activityDate,setActivityDate]=useState(new Date()); // Phase B3
  var[showCalendar,setShowCalendar]=useState(false);
  var[calendarDate,setCalendarDate]=useState(new Date());
  var[showDayDetail,setShowDayDetail]=useState(false);
  var[dayDetailDate,setDayDetailDate]=useState(new Date());
  var[showGoal,setShowGoal]=useState(false);
  var[editGoal,setEditGoal]=useState(null);
  var[initialMealType,setInitialMealType]=useState('lunch');
  var[mealDate,setMealDate]=useState(new Date());
  var[waterDate,setWaterDate]=useState(new Date());
  // Screen time + sleep are end-of-day metrics: default modal date to yesterday.
  function _yest(){var d=new Date();d.setDate(d.getDate()-1);return d;}
  var[screenDate,setScreenDate]=useState(_yest());
  var[sleepDate,setSleepDate]=useState(_yest());
  var[memberFilterId,setMemberFilterId]=useState(null); // W1: filter by member
  var[editScreenTarget,setEditScreenTarget]=useState(false); // B4: pencil-edit modal toggle
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
  var todayW=wellness.filter(function(w){return w.date===today;});
  // Yesterday window — drives the screen-time and sleep cards (end-of-day metrics).
  // isoDate is local-tz; subtract one calendar day. wellness.date is a date column with
  // no TZ, so the yesterday-string we build here matches the column directly.
  var yesterdayDate=new Date();yesterdayDate.setDate(yesterdayDate.getDate()-1);
  var yesterdayISO=isoDate(yesterdayDate);
  var yesterdayW=wellness.filter(function(w){return w.date===yesterdayISO;});
  // Sleep target per member: q20_sleep_hours from current user's questionnaire if
  // available (1–12h range); else 7h (adult default). family_members has no dob
  // column and role doesn't encode age, so non-current-user members all get 7h.
  // The user can adjust by tapping "+ Sleep" and saving — the bar reflects the
  // most-recent value as soon as a sleep row exists.
  function sleepTargetFor(member){
    if(member&&member.userId===userId){
      var q20=Number(userProfile&&userProfile.questionnaire_data&&userProfile.questionnaire_data.q20_sleep_hours);
      if(q20>=1&&q20<=12)return q20;
    }
    return 7;
  }
  // Phase 2.3 step 1: per-member protein lifted to AppContext as familyProteinToday.
  var currentUserMember=(members||[]).find(function(m){return m.userId===userId;})||null;
  var currentUserMemberProfile=(currentUserMember&&memberProfiles)?memberProfiles[currentUserMember.userId]:null;
  var currentUserWeightKg=parseWeightKg(userProfile&&userProfile.weight,userProfile&&userProfile.weight_unit)||(currentUserMemberProfile&&currentUserMemberProfile.weightKg)||null;
  var currentUserProteinTargets=calculateProteinTargets(currentUserWeightKg);
  var todayProteinForCurrentUser=currentUserMember?((familyProteinToday.find(function(x){return x.member.id===currentUserMember.id;})||{}).current||0):0;
  var totalProtein=familyProteinToday.reduce(function(sum,x){return sum+x.current;},0);
  var totalProteinTarget=familyProteinToday.reduce(function(sum,x){return sum+x.target;},0);
  var wellnessGoals=(goals||[]).filter(function(g){var c=String(g.category||'').toLowerCase();return c==='health'||c==='protein'||c==='hydration'||c==='sleep'||c==='screen time';});
  return(<View style={{flex:1,paddingTop:ins.top,backgroundColor:theme.bg}}>
    <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg}/>
    <AddMealModal visible={showMeal||!!editMeal} onClose={function(){setShowMeal(false);setEditMeal(null);setInitialMealType('lunch');}} editMeal={editMeal} initialMealType={initialMealType} initialDate={mealDate}/>
    <UnifiedCalendarModal visible={showCalendar} onClose={function(){setShowCalendar(false);}} context="wellness" selectedDate={calendarDate} onSelectDate={setCalendarDate} onOpenDayDetail={function(d){setCalendarDate(d);setDayDetailDate(d);setShowDayDetail(true);}}/>
    <DayDetailModal visible={showDayDetail} date={dayDetailDate} onClose={function(){setShowDayDetail(false);}} onChangeDate={setDayDetailDate} onEditMeal={function(m){setShowDayDetail(false);setEditMeal(m);setMealDate(toDate(m.date));}} onAddMeal={function(d){setShowDayDetail(false);setMealDate(d);setShowMeal(true);}} onAddWater={function(d){setShowDayDetail(false);setWaterDate(d);setShowWater(true);}} onAddScreen={function(d){setShowDayDetail(false);setScreenDate(d);setShowScreen(true);}} onAddTransaction={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_tx',initialDate:isoDate(d),nonce:Date.now()});}}/>
    <LogWaterModal visible={showWater} onClose={function(){setShowWater(false);}} initialDate={waterDate}/>
    <LogScreenTimeModal visible={showScreen} onClose={function(){setShowScreen(false);}} initialDate={screenDate}/>
    <LogSleepModal visible={showSleep} onClose={function(){setShowSleep(false);}} initialDate={sleepDate}/>
    <LogActivityModal visible={showActivity||!!editActivity} onClose={function(){setShowActivity(false);setEditActivity(null);}} initialDate={activityDate} editActivity={editActivity}/>
    <ModalSheet visible={editScreenTarget} title="Your screen-time target" onClose={function(){setEditScreenTarget(false);}}>
      <Text style={{fontFamily:FF.sans,fontSize:14,lineHeight:21,color:theme.textSecondary,marginBottom:18}}>Set your daily screen-time limit. Used by the Time on Screens hero, the "Stayed under Xh" check on Home, and your ring fill.</Text>
      <View style={{flexDirection:'row',gap:12,alignItems:'center',marginBottom:14}}>
        <TouchableOpacity onPress={function(){
          var next=Math.max(LIMITS.wellness.screenTargetMinH, Number(((screenTargetHrs||2)-0.5).toFixed(1)));
          setScreenTargetHrs&&setScreenTargetHrs(next);
          haptic('light');
        }} style={[z.stepBtn,{borderColor:theme.border}]}><Text style={[z.stepTx,{color:theme.text}]}>−</Text></TouchableOpacity>
        <View style={{flex:1,alignItems:'center'}}>
          <Text style={{fontFamily:FF.sansBold,fontSize:32,letterSpacing:-0.8,color:theme.text}}>{Number(screenTargetHrs||2).toFixed(1)}<Text style={{fontFamily:FF.sans,fontSize:18,color:theme.textSecondary}}> h</Text></Text>
        </View>
        <TouchableOpacity onPress={function(){
          var next=Math.min(LIMITS.wellness.screenTargetMaxH, Number(((screenTargetHrs||2)+0.5).toFixed(1)));
          setScreenTargetHrs&&setScreenTargetHrs(next);
          haptic('light');
        }} style={[z.stepBtn,{borderColor:theme.border}]}><Text style={[z.stepTx,{color:theme.text}]}>+</Text></TouchableOpacity>
      </View>
      <Caps color={theme.muted} style={{marginBottom:14,textAlign:'center'}}>Range: {LIMITS.wellness.screenTargetMinH}h to {LIMITS.wellness.screenTargetMaxH}h · Adjust by 0.5h</Caps>
      {Platform.OS==='android'?<View style={{marginBottom:14,paddingVertical:14,paddingHorizontal:14,borderRadius:12,backgroundColor:theme.surfaceElevated,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <View style={{flex:1,marginRight:10}}>
            <Text style={{fontFamily:FF.sansSemi,fontSize:14,color:theme.text}}>Auto-sync from device</Text>
            <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.textSecondary,marginTop:2,lineHeight:17}}>Pull screen time directly from this device's usage stats. No manual logging.</Text>
          </View>
          <Switch
            value={!!screenTimeAutoEnabled}
            onValueChange={async function(next){
              setScreenTimeAutoEnabled&&setScreenTimeAutoEnabled(next);
              if(next&&requestScreenTimePermission){await requestScreenTimePermission();}
            }}
            trackColor={{true:theme.primary,false:theme.border}}
            thumbColor="#fff"
          />
        </View>
        <Caps color={theme.muted} style={{marginTop:10}}>Coming soon — requires app update with the Android usage-stats native module. The toggle persists your preference now; auto-ingest activates once the native bridge ships.</Caps>
      </View>:null}
      <PrimaryButton full onPress={function(){setEditScreenTarget(false);}}>Done</PrimaryButton>
    </ModalSheet>
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
    {/* Header */}
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',paddingTop:8,marginBottom:14}}>
      <View style={{flex:1,marginRight:12}}>
        <Caps>Today · {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</Caps>
        <Text style={{fontFamily:FF.serif,fontSize:30,letterSpacing:-0.8,color:theme.text,marginTop:6}}>Wellness</Text>
      </View>
      <TouchableOpacity onPress={function(){setShowCalendar(true);}} style={{width:40,height:40,borderRadius:9999,backgroundColor:theme.surfaceElevated,alignItems:'center',justifyContent:'center'}}>
        <CalendarIcon size={20} color={theme.text}/>
      </TouchableOpacity>
    </View>

    {/* Phase 2.3.A v2: Protein Today hero — per-member numbers above each ring (no family-aggregate stat).
        Sibling-pattern overlay so per-ring taps don't bubble to the hero's tap-to-log-meal handler. */}
    <View style={{position:'relative'}}>
      <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setShowMeal(true);}}>
        <Block bg={theme.primary} style={{padding:22}}>
          <Caps color="rgba(255,255,255,0.7)">Protein today</Caps>
          {/* Spacer reserved for the absolute-positioned ring row sibling below */}
          <View style={{height:96,marginTop:22}}/>
          <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:18}}>
            <Text style={{fontFamily:FF.sans,fontSize:12,color:'rgba(255,255,255,0.85)'}}>{members.length} member{members.length===1?'':'s'}</Text>
            <Text style={{fontFamily:FF.sans,fontSize:12,color:'rgba(255,255,255,0.85)'}}>Tap to log meal</Text>
          </View>
        </Block>
      </TouchableOpacity>
      {/* Ring row — sibling overlay. Y offset = padding(22) + caps(~16) + gap(22) = 60. Spacer height (96) accounts for aboveLabel + ring + name. */}
      <View style={{position:'absolute',left:22,right:22,top:60,height:96,justifyContent:'center'}} pointerEvents="box-none">
        {(function(){
          var memberCount=familyProteinToday.length;
          if(memberCount===0)return <Caps color="rgba(255,255,255,0.7)" style={{textAlign:'center'}}>No members yet</Caps>;
          var allZero=familyProteinToday.every(function(x){return (Number(x.current)||0)===0;});
          if(allZero)return <Caps color="rgba(255,255,255,0.7)" style={{textAlign:'center'}}>Today's progress will appear as meals are logged</Caps>;
          var ringDiameter=memberCount<=4?56:(memberCount===5?52:(memberCount===6?48:44));
          var ringStroke=memberCount<=5?4:3.5;
          var useScroll=memberCount>=7;
          var rings=familyProteinToday.map(function(item){
            var nameWords=(item.member.name||'').split(' ').filter(Boolean);
            var initials=nameWords.map(function(p){return p.charAt(0);}).slice(0,2).join('').toUpperCase()||'?';
            var firstName=nameWords[0]||'?';
            var regularTarget=Number(item.targets&&item.targets.regular)||0;
            var ringTarget=regularTarget>0?regularTarget:(Number(item.target)||1);
            var aboveLabel=<Text style={{fontSize:12,color:'#fff',textAlign:'center'}}>
              <Text style={{fontFamily:FF.sansBold,color:'#fff'}}>{item.current}</Text>
              <Text style={{fontFamily:FF.sans,color:'rgba(255,255,255,0.7)'}}>{regularTarget>0?' / '+regularTarget+'g':'g'}</Text>
            </Text>;
            return <FamilyMemberRing
              key={item.member.id||firstName}
              member={{initials:initials,name:firstName,current:item.current,target:ringTarget}}
              variant="protein"
              ringDiameter={ringDiameter}
              ringStroke={ringStroke}
              aboveLabel={aboveLabel}
              onPress={function(){haptic('light');setMemberDetail(item.member);}}
            />;
          });
          if(useScroll){
            return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,alignItems:'center',paddingHorizontal:4}}>
              {rings}
            </ScrollView>;
          }
          var justifyMode=memberCount===1?'center':(memberCount===2?'space-evenly':'space-around');
          return <View style={{flexDirection:'row',alignItems:'center',justifyContent:justifyMode,paddingHorizontal:4}}>
            {rings}
          </View>;
        })()}
      </View>
      <InfoIcon
        title="How protein today works"
        body="Each ring is one family member. The fill shows how close they are to their daily protein target. Tap a member's ring for their detail. Tap anywhere else to log a meal."
        color="rgba(255,255,255,0.7)"
        style={{position:'absolute',top:16,right:16}}
      />
    </View>

    {/* Phase 2.3.B v2: Time on Screens Today hero — KEEPS the family-aggregate big stat (matches user's per-spec request),
        adds per-member numbers above each ring (mirrors Protein hero's per-cell stack). Spacer 78→96 for aboveLabel + ring + name.
        Pencil + InfoIcon as sibling row (top-right) so taps don't bubble to the hero's tap-to-log-screen-time handler. */}
    <View style={{position:'relative',marginTop:12}}>
      <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setShowScreen(true);}}>
        <Block bg={theme.accent} style={{padding:22}}>
          {/* Label changed to YESTERDAY — screen time is end-of-day; you can't know
              today's full total until today is over. Card reads from yesterdayW. */}
          <Caps color="rgba(255,255,255,0.7)">Time on screens yesterday</Caps>
          <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:52,letterSpacing:-2,color:'#fff',lineHeight:54,marginTop:10,height:54}}>{(function(){
            // "Logged" rows have screen_hrs IS NOT NULL after the wellness_logged_distinction
            // migration. NULL = not logged. Sum only over logged rows.
            var loggedRows=yesterdayW.filter(function(w){var v=w.screenHrs;if(typeof v==='undefined')v=w.screen_hrs;return v!==null&&typeof v!=='undefined';});
            if(loggedRows.length===0)return 'Not logged yet';
            var sum=loggedRows.reduce(function(s,w){var v=w.screenHrs;if(typeof v==='undefined')v=w.screen_hrs;return s+Number(v||0);},0);
            if(sum===0)return '0h';
            var hh=Math.floor(sum);
            var mm=Math.round((sum-hh)*60);
            return mm===0?hh+'h':hh+'h '+(mm<10?'0':'')+mm+'m';
          })()}</Text>
          {/* Spacer reserved for the absolute-positioned ring row sibling below. Height 96 fits aboveLabel + ring + name. */}
          <View style={{height:96,marginTop:22}}/>
          <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:18}}>
            <Text style={{fontFamily:FF.sans,fontSize:12,color:'rgba(255,255,255,0.85)'}}>{members.length} member{members.length===1?'':'s'}</Text>
            <Text style={{fontFamily:FF.sans,fontSize:12,color:'rgba(255,255,255,0.85)'}}>Tap to log screen time</Text>
          </View>
        </Block>
      </TouchableOpacity>
      {/* Ring row sibling — Y offset = padding(22) + caps(~16) + gap(10) + big-number lineHeight(54) + gap(22) ≈ 124. Height 96. */}
      <View style={{position:'absolute',left:22,right:22,top:124,height:96,justifyContent:'center'}} pointerEvents="box-none">
        {(function(){
          var memberCount=(members||[]).length;
          if(memberCount===0)return <Caps color="rgba(255,255,255,0.7)" style={{textAlign:'center'}}>No members yet</Caps>;
          var screenTarget=Number(screenTargetHrs)||2;
          var familyScreenYesterday=(members||[]).map(function(m){
            var wellRow=yesterdayW.find(function(w){return (w.memberId||w.member_id)===m.id;})||yesterdayW.find(function(w){return w.memberName===m.name;});
            // current is null when row missing OR row.screen_hrs is NULL — both = "not logged".
            var raw=wellRow?(typeof wellRow.screenHrs!=='undefined'?wellRow.screenHrs:wellRow.screen_hrs):null;
            var current=(raw===null||typeof raw==='undefined')?null:Number(raw);
            return{member:m,target:screenTarget,current:current};
          });
          var allMissing=familyScreenYesterday.every(function(x){return x.current===null;});
          if(allMissing)return <Caps color="rgba(255,255,255,0.7)" style={{textAlign:'center'}}>Yesterday's screen time not logged yet — tap to add</Caps>;
          var ringDiameter=memberCount<=4?56:(memberCount===5?52:(memberCount===6?48:44));
          var ringStroke=memberCount<=5?4:3.5;
          var useScroll=memberCount>=7;
          var rings=familyScreenYesterday.map(function(item){
            var nameWords=(item.member.name||'').split(' ').filter(Boolean);
            var initials=nameWords.map(function(p){return p.charAt(0);}).slice(0,2).join('').toUpperCase()||'?';
            var firstName=nameWords[0]||'?';
            // Label: "— / Xh" when not logged, else "Yh / Xh" with optional "+Zh over" suffix.
            var aboveLabel;
            if(item.current===null){
              aboveLabel=<Text style={{fontSize:12,color:'rgba(255,255,255,0.55)',textAlign:'center'}}>
                <Text style={{fontFamily:FF.sansBold}}>—</Text>
                <Text style={{fontFamily:FF.sans}}>{' / '+item.target+'h'}</Text>
              </Text>;
            }else{
              var hoursStr=item.current===0?'0h':(item.current===Math.floor(item.current)?Math.floor(item.current)+'h':item.current.toFixed(1)+'h');
              var over=item.current-item.target;
              aboveLabel=<Text style={{fontSize:12,color:'#fff',textAlign:'center'}}>
                <Text style={{fontFamily:FF.sansBold,color:'#fff'}}>{hoursStr}</Text>
                <Text style={{fontFamily:FF.sans,color:'rgba(255,255,255,0.7)'}}>{' / '+item.target+'h'}</Text>
                {over>0?<Text style={{fontFamily:FF.sans,color:'rgba(255,255,255,0.85)'}}>{' (+'+(over===Math.floor(over)?Math.floor(over):over.toFixed(1))+'h)'}</Text>:null}
              </Text>;
            }
            return <FamilyMemberBar
              key={item.member.id||firstName}
              member={{initials:initials,name:firstName,current:item.current,target:item.target}}
              ringDiameter={ringDiameter}
              ringStroke={ringStroke}
              aboveLabel={aboveLabel}
              onPress={function(){haptic('light');setMemberDetail(item.member);}}
            />;
          });
          if(useScroll){
            return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,alignItems:'center',paddingHorizontal:4}}>
              {rings}
            </ScrollView>;
          }
          var justifyMode=memberCount===1?'center':(memberCount===2?'space-evenly':'space-around');
          return <View style={{flexDirection:'row',alignItems:'center',justifyContent:justifyMode,paddingHorizontal:4}}>
            {rings}
          </View>;
        })()}
      </View>
      {/* Pencil + InfoIcon row — both absolute-positioned siblings outside the hero TouchableOpacity so taps don't bubble */}
      <View style={{position:'absolute',top:16,right:16,flexDirection:'row',gap:14,alignItems:'center'}}>
        <Pressable onPress={function(){haptic('light');setEditScreenTarget(true);}} hitSlop={{top:6,bottom:6,left:6,right:6}}>
          {function(state){
            var c=state.pressed?theme.primary:'rgba(255,255,255,0.7)';
            return <View style={{
              width:16,height:16,borderRadius:9999,
              borderWidth:1.2,borderColor:c,
              alignItems:'center',justifyContent:'center',
            }}>
              <Text style={{fontFamily:FF.sans,fontSize:9,color:c,marginTop:-1}}>✎</Text>
            </View>;
          }}
        </Pressable>
        <InfoIcon
          title="How time on screens works"
          body={"Each bar is one family member's screen time yesterday. The bar fills toward your "+(Number(screenTargetHrs)||2)+"-hour cap — white while within, amber when over, dashed when not yet logged. Tap the pencil to change the cap."}
          color="rgba(255,255,255,0.7)"
        />
      </View>
    </View>

    {/* ── Sleep card ────────────────────────────────────────────────────────
        Mirrors the corrected Time on Screens card. Reads the same yesterdayW.
        Background is a muted slate (calm, distinct from amber screen-time and
        olive protein cards). No streaks, no scores, no comparisons. */}
    <View style={{position:'relative',marginTop:12}}>
      <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setShowSleep(true);}}>
        <Block bg="#3F5269" style={{padding:22}}>
          <Caps color="rgba(255,255,255,0.7)">Time asleep last night</Caps>
          <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:52,letterSpacing:-2,color:'#fff',lineHeight:54,marginTop:10,height:54}}>{(function(){
            var loggedRows=yesterdayW.filter(function(w){return w.sleep_hours!==null&&typeof w.sleep_hours!=='undefined';});
            if(loggedRows.length===0)return 'Not logged yet';
            var sum=loggedRows.reduce(function(s,w){return s+Number(w.sleep_hours||0);},0);
            if(sum===0)return '0h';
            var hh=Math.floor(sum);
            var mm=Math.round((sum-hh)*60);
            return mm===0?hh+'h':hh+'h '+(mm<10?'0':'')+mm+'m';
          })()}</Text>
          <View style={{height:96,marginTop:22}}/>
          <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:18}}>
            <Text style={{fontFamily:FF.sans,fontSize:12,color:'rgba(255,255,255,0.85)'}}>{members.length} member{members.length===1?'':'s'}</Text>
            <Text style={{fontFamily:FF.sans,fontSize:12,color:'rgba(255,255,255,0.85)'}}>Tap to log sleep</Text>
          </View>
        </Block>
      </TouchableOpacity>
      <View style={{position:'absolute',left:22,right:22,top:124,height:96,justifyContent:'center'}} pointerEvents="box-none">
        {(function(){
          var memberCount=(members||[]).length;
          if(memberCount===0)return <Caps color="rgba(255,255,255,0.7)" style={{textAlign:'center'}}>No members yet</Caps>;
          var familySleep=(members||[]).map(function(m){
            var wellRow=yesterdayW.find(function(w){return (w.memberId||w.member_id)===m.id;})||yesterdayW.find(function(w){return w.memberName===m.name;});
            var raw=wellRow?wellRow.sleep_hours:null;
            var current=(raw===null||typeof raw==='undefined')?null:Number(raw);
            return{member:m,target:sleepTargetFor(m),current:current};
          });
          var allMissing=familySleep.every(function(x){return x.current===null;});
          if(allMissing)return <Caps color="rgba(255,255,255,0.7)" style={{textAlign:'center'}}>Last night's sleep not logged yet — tap to add</Caps>;
          var ringDiameter=memberCount<=4?56:(memberCount===5?52:(memberCount===6?48:44));
          var useScroll=memberCount>=7;
          var rings=familySleep.map(function(item){
            var nameWords=(item.member.name||'').split(' ').filter(Boolean);
            var initials=nameWords.map(function(p){return p.charAt(0);}).slice(0,2).join('').toUpperCase()||'?';
            var firstName=nameWords[0]||'?';
            var aboveLabel;
            if(item.current===null){
              aboveLabel=<Text style={{fontSize:12,color:'rgba(255,255,255,0.55)',textAlign:'center'}}>
                <Text style={{fontFamily:FF.sansBold}}>—</Text>
                <Text style={{fontFamily:FF.sans}}>{' / '+item.target+'h'}</Text>
              </Text>;
            }else{
              var hoursStr=item.current===0?'0h':(item.current===Math.floor(item.current)?Math.floor(item.current)+'h':item.current.toFixed(1)+'h');
              aboveLabel=<Text style={{fontSize:12,color:'#fff',textAlign:'center'}}>
                <Text style={{fontFamily:FF.sansBold,color:'#fff'}}>{hoursStr}</Text>
                <Text style={{fontFamily:FF.sans,color:'rgba(255,255,255,0.7)'}}>{' / '+item.target+'h'}</Text>
              </Text>;
            }
            return <FamilyMemberBar
              key={'sleep_'+(item.member.id||firstName)}
              member={{initials:initials,name:firstName,current:item.current,target:item.target}}
              ringDiameter={ringDiameter}
              aboveLabel={aboveLabel}
              onPress={function(){haptic('light');setMemberDetail(item.member);}}
            />;
          });
          if(useScroll){
            return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,alignItems:'center',paddingHorizontal:4}}>
              {rings}
            </ScrollView>;
          }
          var justifyMode=memberCount===1?'center':(memberCount===2?'space-evenly':'space-around');
          return <View style={{flexDirection:'row',alignItems:'center',justifyContent:justifyMode,paddingHorizontal:4}}>
            {rings}
          </View>;
        })()}
      </View>
      <View style={{position:'absolute',top:16,right:16,flexDirection:'row',gap:14,alignItems:'center'}}>
        <InfoIcon
          title="How sleep tracking works"
          body="Each bar is one family member's sleep last night. Default target is 7 hours (your questionnaire answer overrides for you). White fill while within target, amber if you slept way more or less than usual, dashed when not yet logged. No streaks, no comparisons — just a quiet record."
          color="rgba(255,255,255,0.7)"
        />
      </View>
    </View>

    {/* Phase 2.3.C: Member chip strip + hint — moved above More Details divider per spec resulting order. */}
    {members.length>0&&<Caps color={theme.muted} style={{marginTop:18,marginBottom:8,textAlign:'center'}}>Tap to focus on one member · Long-press for their detail</Caps>}
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
      <Text style={[z.cap,{color:theme.primary,fontWeight:'600'}]}>Showing {(members.find(function(m){return m.id===memberFilterId;})||{}).name||'one member'} only · long-press an avatar for their detail</Text>
    </View>}

    {/* Action buttons: Meal / Screen / Sleep / Activity. Wraps to second row on
        narrow screens via flexWrap — keeps all four discoverable per spec C.5
        (no scrollable row, since that hides options). */}
    <View style={[z.row,{gap:8,marginTop:4,flexWrap:'wrap',rowGap:8}]}>
      <View style={{flexBasis:'48%',flexGrow:1}}><PrimaryButton full onPress={function(){haptic('light');setShowMeal(true);}}>+ Meal</PrimaryButton></View>
      <View style={{flexBasis:'48%',flexGrow:1}}><SecondaryButton full onPress={function(){haptic('light');setShowScreen(true);}}>+ Screen</SecondaryButton></View>
      <View style={{flexBasis:'48%',flexGrow:1}}><SecondaryButton full onPress={function(){haptic('light');setShowSleep(true);}}>+ Sleep</SecondaryButton></View>
      <View style={{flexBasis:'48%',flexGrow:1}}><TouchableOpacity activeOpacity={0.8} onPress={function(){haptic('light');setShowActivity(true);}} style={{height:48,borderRadius:12,paddingHorizontal:14,alignItems:'center',justifyContent:'center',backgroundColor:theme.primaryLight}}><Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:14,color:theme.primary,letterSpacing:0.1}}>+ Activity</Text></TouchableOpacity></View>
    </View>

    {/* Phase 2.3.E: Body goals — moved alongside action buttons per spec. */}
    <Sec>Body goals you’ve set</Sec>
    {wellnessGoals.slice(0,5).map(function(g){var pct=g.target>0?Math.round((Number(g.current||0)/Number(g.target||1))*100):0;return <TouchableOpacity key={g.id} style={[z.card,{backgroundColor:theme.card,borderColor:theme.border,marginBottom:8}]} onPress={function(){haptic('light');setEditGoal(g);}}><View style={[z.row,{justifyContent:'space-between'}]}><Text style={[z.txM,{color:theme.text}]}>{g.name}</Text><Text style={[z.fv,{color:pct>=100?'#0F6E56':'#BA7517'}]}>{pct}%</Text></View><Text style={[z.cap,{color:theme.muted}]}>{g.category||'Wellness'} · {fmt(g.current||0)} / {fmt(g.target||0)}</Text><Bar pct={Math.min(pct,100)} color={pct>=100?'#0F6E56':'#EF9F27'}/></TouchableOpacity>;})}
    {wellnessGoals.length===0&&<Text style={[z.cap,{color:theme.muted}]}>No body goals yet.</Text>}
    <View style={{alignSelf:'flex-start',marginBottom:6}}><PrimaryButton onPress={function(){setShowGoal(true);}}>+ New body goal</PrimaryButton></View>

    {/* More details divider */}
    <View style={{flexDirection:'row',alignItems:'center',marginTop:24,marginBottom:14}}>
      <View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:theme.border}}/>
      <Caps color={theme.muted} style={{marginHorizontal:12}}>More details</Caps>
      <View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:theme.border}}/>
    </View>

    {/* Protein this week — moved below More Details divider per spec resulting order #7. */}
    <Block style={{marginTop:0,padding:16}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:18,letterSpacing:-0.4,color:theme.text}}>Protein this week</Text>
        <Caps>g / day avg</Caps>
      </View>
      {(memberFilterId?familyProteinToday.filter(function(x){return x.member.id===memberFilterId;}):familyProteinToday).map(function(item,i,arr){
        var m=item.member;
        var weekAvg=Math.round((meals||[]).filter(function(ml){return isThisWeek(ml.date)&&(ml.memberId||ml.member_id)===m.id;}).reduce(function(s,ml){return s+Number(ml.protein||0);},0)/7);
        var ok=weekAvg>=item.target;
        return <TouchableOpacity key={'pw_'+m.id} activeOpacity={0.7} onPress={function(){haptic('light');setMemberDetail(m);}} style={{marginBottom:i<arr.length-1?12:0}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:6}}>
            <Avatar name={m.name||'?'} color={SLOTS[i%5].bg} size={22}/>
            <Text style={{flex:1,fontFamily:FF.sans,fontSize:14,fontWeight:'500',color:theme.text}}>{m.name}</Text>
            <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:13,color:ok?theme.primary:theme.accent}}>{weekAvg}g</Text>
            <Caps color={theme.muted}>/ {item.target}</Caps>
          </View>
          <Progress value={item.target>0?Math.min((weekAvg/item.target)*100,100):0} color={ok?theme.primary:theme.accent}/>
        </TouchableOpacity>;
      })}
    </Block>

    {/* Phase 2.4-cleanup A6: Water target card — unnested from inside the protein target card and placed as its own sibling directly below "Protein this week". */}
    <View style={[z.card,{marginTop:12,backgroundColor:theme.card,borderColor:theme.border}]}>
      <View style={[z.row,{justifyContent:'space-between',alignItems:'center',marginBottom:6}]}>
        <Text style={[z.sub,{color:theme.text}]}>Your water target today</Text>
        <Text style={[z.fv,{color:theme.text}]}>{Number(waterTargetLitres||2.5).toFixed(1)} L</Text>
      </View>
      <View style={[z.row,{gap:8,alignItems:'center',marginTop:6}]}>
        <TouchableOpacity onPress={async function(){
          var next=Math.max(LIMITS.wellness.waterTargetMinL, Number(((waterTargetLitres||2.5)-0.5).toFixed(1)));
          setWaterTargetLitres&&setWaterTargetLitres(next);
          haptic('light');
          try{await supabase.from('users').update({water_target_litres:next}).eq('id',userId);}catch(e){}
        }} style={[z.stepBtn,{borderColor:theme.border}]}><Text style={[z.stepTx,{color:theme.text}]}>−</Text></TouchableOpacity>
        <View style={{flex:1,alignItems:'center'}}>
          <Text style={[z.cap,{color:theme.textSecondary}]}>Adjust by 0.5 L</Text>
        </View>
        <TouchableOpacity onPress={async function(){
          var next=Math.min(LIMITS.wellness.waterTargetMaxL, Number(((waterTargetLitres||2.5)+0.5).toFixed(1)));
          setWaterTargetLitres&&setWaterTargetLitres(next);
          haptic('light');
          try{await supabase.from('users').update({water_target_litres:next}).eq('id',userId);}catch(e){}
        }} style={[z.stepBtn,{borderColor:theme.border}]}><Text style={[z.stepTx,{color:theme.text}]}>+</Text></TouchableOpacity>
      </View>
      <Text style={[z.cap,{marginTop:8,color:theme.textSecondary}]}>You'll be asked at end of day if you hit your target. No more glass-by-glass logging.</Text>
    </View>

    {/* Phase 2.4-cleanup A5: Protein target card — slimmed to just the per-user target row (water target extracted, duplicate per-member bars deleted per A7). */}
    <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setShowMeal(true);}} style={[z.card,{marginTop:12,backgroundColor:theme.card,borderColor:theme.border}]}>
      <Text style={[z.sub,{color:theme.text}]}>Your protein target today</Text>
      <Text style={[z.fv,{marginTop:4,color:theme.text}]}>{currentUserProteinTargets.regular}g (Regular) | {currentUserProteinTargets.active}g (Active/Gym)</Text>
      <Text style={[z.cap,{marginTop:4,color:theme.textSecondary}]}>Today: {todayProteinForCurrentUser}g</Text>
      <Bar pct={currentUserProteinTargets.active>0?Math.min((todayProteinForCurrentUser/currentUserProteinTargets.active)*100,100):0} color={theme.success}/>
    </TouchableOpacity>

    {/* What was eaten today — summary by meal type. Moved here from upper position per spec resulting order #11. */}
    <Block style={{marginTop:12,padding:16}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:18,letterSpacing:-0.4,color:theme.text}}>What was eaten today</Text>
        <TouchableOpacity onPress={function(){haptic('light');setShowMeal(true);}} hitSlop={{top:6,bottom:6,left:6,right:6}}>
          <Caps color={theme.primary}>+ Log meal</Caps>
        </TouchableOpacity>
      </View>
      {(function(){
        var typeOrder=['breakfast','lunch','dinner','snack'];
        // When a member chip is active, show a single member's day grouped by meal slot (existing behavior).
        // When no chip is active ("Whole family"), render per-member rows side-by-side instead of summing
        // kcal/protein across the family — that sum would be a household aggregate, which we don't show.
        if(memberFilterId){
          var byType={breakfast:[],lunch:[],dinner:[],snack:[]};
          todayMeals.filter(function(m){return m.memberId===memberFilterId;}).forEach(function(m){
            var t=String(m.mealTime||m.meal_time||'').toLowerCase();
            if(byType[t])byType[t].push(m);
            else byType.snack.push(m);
          });
          var rendered=[];
          typeOrder.forEach(function(t){
            var rows=byType[t];
            if(!rows||rows.length===0)return;
            var summary=rows.map(function(r){return r.items;}).join(' · ');
            var totalKcal=rows.reduce(function(s,r){return s+Number(r.cal||0);},0);
            var totalP=rows.reduce(function(s,r){return s+Number(r.protein||0);},0);
            rendered.push(<View key={t} style={{paddingVertical:10,borderTopWidth:rendered.length>0?StyleSheet.hairlineWidth:0,borderTopColor:theme.border}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'}}>
                <Caps>{t.charAt(0).toUpperCase()+t.slice(1)}</Caps>
                <Caps color={theme.textSecondary}>{totalKcal} kcal · {totalP}g protein</Caps>
              </View>
              <Text style={{fontFamily:FF.sans,fontSize:14,fontWeight:'500',color:theme.text,marginTop:4}}>{summary}</Text>
            </View>);
          });
          if(rendered.length===0)return <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted,paddingVertical:6}}>No meals captured yet today.</Text>;
          return rendered;
        }
        var perMember=(members||[]).map(function(m){
          return{member:m,meals:todayMeals.filter(function(ml){return (ml.memberId||ml.member_id)===m.id;})};
        }).filter(function(r){return r.meals.length>0;});
        if(perMember.length===0)return <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted,paddingVertical:6}}>No meals captured yet today.</Text>;
        return perMember.map(function(row,idx){
          var byType={breakfast:[],lunch:[],dinner:[],snack:[]};
          row.meals.forEach(function(m){
            var t=String(m.mealTime||m.meal_time||'').toLowerCase();
            if(byType[t])byType[t].push(m);
            else byType.snack.push(m);
          });
          var totalKcal=row.meals.reduce(function(s,r){return s+Number(r.cal||0);},0);
          var totalP=row.meals.reduce(function(s,r){return s+Number(r.protein||0);},0);
          return <View key={'eaten_'+row.member.id} style={{paddingVertical:12,borderTopWidth:idx>0?StyleSheet.hairlineWidth:0,borderTopColor:theme.border}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
              <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:14,color:theme.text}}>{row.member.name}</Text>
              <Caps color={theme.textSecondary}>{totalKcal} kcal · {totalP}g protein</Caps>
            </View>
            {typeOrder.map(function(t){
              var rows=byType[t];
              if(!rows||rows.length===0)return null;
              var summary=rows.map(function(r){return r.items;}).join(' · ');
              return <Text key={t} style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,marginTop:3,lineHeight:18}}>
                <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',color:theme.text}}>{t.charAt(0).toUpperCase()+t.slice(1)}: </Text>{summary}
              </Text>;
            })}
          </View>;
        });
      })()}
    </Block>
    <Sec>Today’s meal log</Sec>{(memberFilterId?todayMeals.filter(function(m){return m.memberId===memberFilterId;}):todayMeals).length===0&&<Text style={[z.cap,{color:theme.muted}]}>No meals captured today.</Text>}
    {/* W11: Meal time/member name now opens edit on tap */}
    {(memberFilterId?todayMeals.filter(function(m){return m.memberId===memberFilterId;}):todayMeals).map(function(m,i){return<View key={m.id||('meal_'+(m.memberId||m.member_name||'member')+'_'+(m.date||'date')+'_'+(m.mealTime||m.meal_type||'type')+'_'+i)} style={[z.card,{backgroundColor:theme.card,borderColor:theme.border,marginBottom:8}]}>
      <View style={[z.row,{justifyContent:'space-between',marginBottom:4}]}>
        <TouchableOpacity style={{flex:1}} onPress={function(){if(canModifyMemberData(isAdmin,members,userId,m.memberId)){haptic('light');setEditMeal(m);}else{Alert.alert('Read only','Only admin can edit other member logs.');}}}><Text style={[z.txM,{color:theme.text}]}>{m.mealTime} - {m.memberName}</Text><Text style={[z.cap,{color:theme.muted}]}>{displayDate(m.date)}</Text></TouchableOpacity>
        <View style={z.row}><TouchableOpacity onPress={function(){if(canModifyMemberData(isAdmin,members,userId,m.memberId)){setEditMeal(m);}else{Alert.alert('Read only','Only admin can edit other member logs.');}}} style={z.editBtn}><Text style={z.editTx}>✎</Text></TouchableOpacity><TouchableOpacity onPress={function(){deleteMeal(m);}} style={z.editBtn}><Text style={[z.editTx,{color:'#E24B4A'}]}>🗑</Text></TouchableOpacity></View>
      </View>
      <Text style={[z.body,{marginBottom:6,color:theme.text}]}>{m.items}</Text>
      <View style={z.row}><Text style={[z.macro,{backgroundColor:theme.surfaceElevated,color:theme.textSecondary}]}>Protein: {m.protein}g</Text><Text style={[z.macro,{backgroundColor:theme.surfaceElevated,color:theme.textSecondary}]}>Carbs: {m.carbs}g</Text><Text style={[z.macro,{backgroundColor:theme.surfaceElevated,color:theme.textSecondary}]}>Cal: {m.cal}</Text></View>
    </View>;})}
    {/* Phase B3: Today's activities — list of activity rows for today, filtered by member if a filter is active. */}
    <Sec>Today’s activities</Sec>
    {(function(){
      var todayISO=isoDate(new Date());
      var todayActivities=(activities||[]).filter(function(a){return a.date===todayISO;});
      if(memberFilterId)todayActivities=todayActivities.filter(function(a){return a.memberId===memberFilterId;});
      if(todayActivities.length===0)return <Text style={[z.cap,{color:theme.muted}]}>No activity logged today. Tap + Activity to start.</Text>;
      return todayActivities.map(function(a,i){
        var canEdit=canModifyMemberData(isAdmin,members,userId,a.memberId);
        var memberName=a.memberName||(members.find(function(m){return m.id===a.memberId;})||{}).name||'Member';
        var typeLabel=String(a.activity_type||'activity');
        typeLabel=typeLabel.charAt(0).toUpperCase()+typeLabel.slice(1);
        return <View key={a.id||('act_'+i)} style={[z.card,{backgroundColor:theme.card,borderColor:theme.border,marginBottom:8}]}>
          <View style={[z.row,{justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}]}>
            <View style={{flex:1}}>
              <Text style={[z.txM,{color:theme.text}]}>{typeLabel} · {a.duration_minutes} min</Text>
              <Text style={[z.cap,{color:theme.muted,marginTop:2}]}>{memberName} · {displayDate(a.date)}</Text>
            </View>
            {canEdit?<View style={z.row}>
              <TouchableOpacity onPress={function(){haptic('light');setEditActivity(a);}} style={z.editBtn}><Text style={z.editTx}>✎</Text></TouchableOpacity>
              <TouchableOpacity onPress={function(){
                Alert.alert('Delete activity','Remove this activity log?',[
                  {text:'Cancel',style:'cancel'},
                  {text:'Delete',style:'destructive',onPress:async function(){try{await deleteActivity(a.id);haptic('success');}catch(e){haptic('error');showFriendlyError('Could not delete',e);}}}
                ]);
              }} style={z.editBtn}><Text style={[z.editTx,{color:'#E24B4A'}]}>🗑</Text></TouchableOpacity>
            </View>:null}
          </View>
          {a.note?<Text style={[z.body,{color:theme.text,marginTop:4}]}>{a.note}</Text>:null}
        </View>;
      });
    })()}
    <Sec>Time on screens today</Sec>{(memberFilterId?members.filter(function(m){return m.id===memberFilterId;}):members).map(function(m){var w=todayW.find(function(w){return (w.memberId||w.member_id)===m.id;})||todayW.find(function(w){return w.memberName===m.name;});var hrs=w?(w.screenHrs!=null?w.screenHrs:(w.screen_hrs!=null?w.screen_hrs:null)):null;var hasLog=hrs!=null;var under=hasLog&&hrs<=4;return<TouchableOpacity key={m.id} activeOpacity={0.7} onPress={function(){haptic('light');setScreenDate(new Date());setShowScreen(true);}} style={[z.card,{backgroundColor:theme.card,borderColor:theme.border,marginBottom:8}]}><View style={[z.row,{justifyContent:'space-between',marginBottom:6}]}><Text style={[z.txM,{color:theme.text}]}>{m.name}</Text><View style={z.row}><Text style={[z.fv,{color:!hasLog||hrs===0?'#888':under?'#085041':'#E24B4A'}]}>{hasLog?hrs+' hrs':'\u2014'}</Text>{w&&<TouchableOpacity onPress={function(){deleteWellnessRow(w);}} style={z.editBtn}><Text style={[z.editTx,{color:'#E24B4A'}]}>🗑</Text></TouchableOpacity>}</View></View>{hasLog&&<Bar pct={Math.min((hrs/4)*100,100)} color={under?'#0F6E56':'#E24B4A'}/>}</TouchableOpacity>;})}
    {/* W14: Insight card jumps to Reflect protein trend */}
    {totalProtein>0&&<TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setQuickAction&&setQuickAction({action:'focus_protein_trend',nonce:Date.now()});navigation.navigate('Reflect');}} style={z.insight}><Text style={z.insightTx}>Your family ate {totalProtein}g of protein today. {totalProtein>=totalProteinTarget?'Everyone close to target.':'One egg or some paneer would close the gap.'} {'›'}</Text></TouchableOpacity>}
    <View style={{height:32}}/></ScrollView></View>);
}

// ═══════════════════════════════════════════════════════════════
// INSIGHTS SCREEN
// ═══════════════════════════════════════════════════════════════
function ReflectScreen(){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var navigation=useNavigation();
  var{userId,familyId,members,transactions,meals,wellness,todayNudge,nudgeHistory,refreshNudges,refreshTodayNudge,refreshTransactions,refreshMeals,refreshWellness,recurringTransactions,refreshRecurringTransactions,quickAction,setQuickAction,dismissNudge,dismissedNudgeIds,upsertTransactionLocal,activities}=useApp();
  var[selectedDate,setSelectedDate]=useState(new Date());
  var[showCalendar,setShowCalendar]=useState(false);
  var[showDayDetail,setShowDayDetail]=useState(false);
  var[dayDetailDate,setDayDetailDate]=useState(new Date());
  var[currentMonth,setCurrentMonth]=useState(startOfDay(new Date()));
  var[selectedHistoryDate,setSelectedHistoryDate]=useState('');
  var[historyOpen,setHistoryOpen]=useState(false);
  var[analyticsPeriod,setAnalyticsPeriod]=useState('month');
  var[monthCache,setMonthCache]=useState({});
  var[showWholeMonth,setShowWholeMonth]=useState(false); // Phase 2.4.A: collapse "The whole month" by default
  var[trendModal,setTrendModal]=useState(null); // {kind:'spend'|'protein'} for I8/I9
  var[editTx,setEditTx]=useState(null); // I15: tap a recurring row → open the matching tx
  var[refreshing,setRefreshing]=useState(false);
  var[memberFilterId,setMemberFilterId]=useState(null);
  var perms=useFamilyPermissions();

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
      // already on Reflect — ensure selectedDate is today, scroll-to-top happens by default
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

  // Hero block computations (added for design-faithful top section)
  var daysOnRhythm=weekly.filter(function(w){return w.percent>=80;}).length;
  var personalStreak=0;
  for(var sk=0;sk<90;sk++){
    var sd=addDays(new Date(),-sk);
    if(calcStreakCompletion(familyId,sd,meals,wellness))personalStreak++;
    else break;
  }
  var monthlyTxs=(transactions||[]).filter(function(t){return isThisMonth(t.date);});
  var monthIncome=monthlyTxs.filter(function(t){return t.category==='Income';}).reduce(function(s,t){return s+(t.amount||0);},0);
  var monthExpenses=monthlyTxs.filter(function(t){return t.category!=='Income';}).reduce(function(s,t){return s+(t.amount||0);},0);
  var savedThisMonth=monthIncome-monthExpenses;
  var savingsRate=monthIncome>0?Math.round((savedThisMonth/monthIncome)*100):0;
  var weekMealsAll=(meals||[]).filter(function(m){return isThisWeek(m.date);});
  var weekProteinTotal=weekMealsAll.reduce(function(s,m){return s+Number(m.protein||0);},0);
  var familySize=Math.max((members||[]).length,1);
  var familyAvgProtein=Math.round(weekProteinTotal/7/familySize);

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
  // "What you spend on" pie + daily spend bars react to the chip strip below.
  var analyticsTx=(transactions||[]).filter(function(t){
    if(t.category==='Income')return false;
    if(toDate(t.date)<startOfDay(analyticsStart))return false;
    if(memberFilterId&&(t.memberId||t.member_id)!==memberFilterId)return false;
    return true;
  });
  var reflectFilteredMember=memberFilterId?(members||[]).find(function(m){return m.id===memberFilterId;}):null;
  var reflectFilteredMemberName=reflectFilteredMember?(reflectFilteredMember.name||'this member').split(' ')[0]:null;
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
    return <TouchableOpacity key={title} style={[z.card,{backgroundColor:theme.card,borderColor:theme.border,marginBottom:8}]} onPress={function(){setQuickAction&&setQuickAction(action);if(action&&action.tab)navigation.navigate(action.tab);}}>
      <Text style={[z.txM,{color:theme.text}]}>{title}</Text>
      <Text style={[z.cap,{color:theme.muted}]}>{subtitle}</Text>
    </TouchableOpacity>;
  }

  var quickCards=[];
  if(selectedSummary.percent<100){
    if(!selectedSummary.flags.transaction)quickCards.push(quickActionCard('Capture an entry','The day isn’t fully seen yet',{action:'open_tx',tab:'Finance',nonce:Date.now()}));
    if(!selectedSummary.flags.breakfast)quickCards.push(quickActionCard('Note breakfast','Breakfast still pending',{action:'open_meal',mealType:'breakfast',tab:'Wellness',nonce:Date.now()}));
    if(!selectedSummary.flags.lunch)quickCards.push(quickActionCard('Note lunch','Lunch still pending',{action:'open_meal',mealType:'lunch',tab:'Wellness',nonce:Date.now()}));
    if(!selectedSummary.flags.dinner)quickCards.push(quickActionCard('Note dinner','Dinner still pending',{action:'open_meal',mealType:'dinner',tab:'Wellness',nonce:Date.now()}));
    if(!selectedSummary.flags.screen)quickCards.push(quickActionCard('Note screen time','Screen time still pending',{action:'open_screen',tab:'Wellness',nonce:Date.now()}));
  }

  return(<View style={{flex:1,paddingTop:ins.top,backgroundColor:theme.bg}}>
    <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg}/>
    <UnifiedCalendarModal visible={showCalendar} onClose={function(){setShowCalendar(false);}} context="insights" selectedDate={selectedDate} onSelectDate={setSelectedDate} onOpenDayDetail={function(d){setSelectedDate(d);setDayDetailDate(d);setShowDayDetail(true);}}/>
    <DayDetailModal visible={showDayDetail} date={dayDetailDate} onClose={function(){setShowDayDetail(false);}} onChangeDate={function(d){setDayDetailDate(d);setSelectedDate(d);}} onAddTransaction={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_tx',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Finance');}} onAddMeal={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_meal',mealType:'lunch',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}} onAddWater={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_water',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}} onAddScreen={function(d){setShowDayDetail(false);setQuickAction&&setQuickAction({action:'open_screen',initialDate:isoDate(d),nonce:Date.now()});navigation.navigate('Wellness');}}/>

    <ScrollView style={z.fl} contentContainerStyle={{padding:16,paddingTop:8,paddingBottom:32}} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.primary} colors={[theme.primary]}/>}
    >
      {/* Header */}
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',paddingTop:8,marginBottom:14}}>
        <View style={{flex:1,marginRight:12}}>
          <Caps>{new Date().toLocaleString('en-IN',{month:'long',year:'numeric'})}</Caps>
          <Text style={{fontFamily:FF.serif,fontSize:36,letterSpacing:-1,color:theme.text,marginTop:6,lineHeight:38}}>Reflections</Text>
        </View>
        <TouchableOpacity onPress={function(){setShowCalendar(true);}} style={{
          width:40,height:40,borderRadius:9999,
          backgroundColor:theme.surfaceElevated,
          alignItems:'center',justifyContent:'center',
        }}>
          <CalendarIcon size={20} color={theme.text}/>
        </TouchableOpacity>
      </View>

      {/* Overall reflections banner */}
      <Text style={{fontFamily:FF.serif,fontSize:22,letterSpacing:-0.4,color:theme.text,marginTop:8,marginBottom:6}}>Overall reflections</Text>
      <Caps color={theme.muted} style={{marginBottom:10}}>Patterns across money and wellness</Caps>

      {/* Pattern hero — primary block with italic-serif prose + 2 stats */}
      <Block bg={theme.primary} style={{padding:20}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'}}>
          <Caps color="rgba(255,255,255,0.7)">The pattern this week</Caps>
          {visibleTodayNudge&&<TouchableOpacity onPress={function(){dismissNudge&&dismissNudge(visibleTodayNudge.id);}} hitSlop={{top:6,bottom:6,left:6,right:6}}>
            <Caps color="rgba(255,255,255,0.85)">Dismiss</Caps>
          </TouchableOpacity>}
        </View>
        <Text style={{fontFamily:FF.serifItalic,fontSize:19,color:'#fff',marginTop:8,lineHeight:25}}>
          {visibleTodayNudge?'“'+visibleTodayNudge.nudge_text+'”':'“Steady week. Keep going at your own rhythm.”'}
        </Text>
        <View style={{height:StyleSheet.hairlineWidth,backgroundColor:'rgba(255,255,255,0.25)',marginVertical:16}}/>
        <View style={{flexDirection:'row',gap:24}}>
          <View style={{flex:1}}>
            <Caps color="rgba(255,255,255,0.7)">Days on rhythm</Caps>
            <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:28,letterSpacing:-0.8,color:'#fff',marginTop:4}}>{daysOnRhythm}<Text style={{fontSize:14,fontWeight:'500',color:'rgba(255,255,255,0.7)'}}> / 7</Text></Text>
          </View>
          <View style={{flex:1}}>
            <Caps color="rgba(255,255,255,0.7)">Streak</Caps>
            <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:28,letterSpacing:-0.8,color:'#fff',marginTop:4}}>{personalStreak}<Text style={{fontSize:14,fontWeight:'500',color:'rgba(255,255,255,0.7)'}}> {personalStreak===1?'day':'days'}</Text></Text>
          </View>
        </View>
      </Block>

      {/* Finance banner */}
      <Text style={{fontFamily:FF.serif,fontSize:22,letterSpacing:-0.4,color:theme.text,marginTop:24,marginBottom:6}}>Reflections on Finance</Text>
      <Caps color={theme.muted} style={{marginBottom:10}}>How money has been moving this month</Caps>

      {/* Savings hero */}
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setTrendModal({kind:'spend'});}}>
        <Block style={{padding:20}}>
          <Hero label="Saved this month" prefix="₹" value={fmt(Math.max(savedThisMonth,0))} size={36} accent={theme.primary}/>
          <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,marginTop:14,lineHeight:20}}>
            {monthIncome>0?savingsRate+'% of your earnings · tap for full trend':'Add some income to see your savings rate · tap for full trend'}
          </Text>
        </Block>
      </TouchableOpacity>

      {/* Wellness banner */}
      <Text style={{fontFamily:FF.serif,fontSize:22,letterSpacing:-0.4,color:theme.text,marginTop:24,marginBottom:6}}>Reflections on Wellness</Text>
      <Caps color={theme.muted} style={{marginBottom:10}}>What your bodies have been telling you</Caps>

      {/* Protein hero */}
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setTrendModal({kind:'protein'});}}>
        <Block bg={theme.accentLight} style={{padding:20}}>
          <Hero label="Family avg protein" value={familyAvgProtein+'g'} suffix="/ day" size={36} accent={theme.accent}/>
          <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,marginTop:14,lineHeight:20}}>
            Across {familySize} member{familySize===1?'':'s'} · last 7 days · tap for full trend
          </Text>
        </Block>
      </TouchableOpacity>

      {/* Member chip strip — drill into one member's reflections. Top hero cards stay aggregate.
          Permission gate: tier='member' can only pick "Whole family" or self; other taps alert.
          Reflect mixes finance + wellness, so the gate covers the whole tab (per spec). */}
      <View style={{marginTop:18}}>
        <MemberChipStrip
          members={members}
          selectedId={memberFilterId}
          onSelect={setMemberFilterId}
          gate={function(nextId){
            if(!nextId)return true;
            if(perms.tier==='creator'||perms.tier==='co_admin')return true;
            if(nextId===perms.currentMemberId)return true;
            var target=(members||[]).find(function(m){return m.id===nextId;});
            var targetName=target?(target.name||'this member').split(' ')[0]:'this member';
            Alert.alert('No access',targetName+"'s reflections are private. Ask a family admin if you need this.");
            return false;
          }}
        />
      </View>

      {/* Phase B5: Activity this week — per-member minutes total, sorted descending. Mirrors Protein this week pattern. */}
      <Block style={{marginTop:12,padding:16}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:18,letterSpacing:-0.4,color:theme.text}}>Activity this week</Text>
          <Caps>min · last 7 days</Caps>
        </View>
        {(function(){
          var rows=(members||[]).map(function(m){
            var mins=(activities||[]).filter(function(a){return isThisWeek(a.date)&&(a.memberId||a.member_id)===m.id;}).reduce(function(s,a){return s+Number(a.duration_minutes||0);},0);
            return{member:m,minutes:mins};
          }).sort(function(a,b){return b.minutes-a.minutes;});
          var hasAny=rows.some(function(r){return r.minutes>0;});
          if(!hasAny)return <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted,paddingVertical:6}}>No activity logged this week. Walks, workouts, yoga — they all count.</Text>;
          var maxMins=rows.reduce(function(mx,r){return Math.max(mx,r.minutes);},1);
          return rows.map(function(r,i,arr){
            var pct=Math.round((r.minutes/Math.max(maxMins,1))*100);
            return <View key={'aw_'+r.member.id} style={{marginBottom:i<arr.length-1?12:0}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:6}}>
                <Avatar name={r.member.name||'?'} color={SLOTS[i%5].bg} size={22}/>
                <Text style={{flex:1,fontFamily:FF.sans,fontSize:14,fontWeight:'500',color:theme.text}}>{r.member.name}</Text>
                <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:13,color:r.minutes>0?theme.primary:theme.muted}}>{r.minutes} min</Text>
              </View>
              <Progress value={pct} color={r.minutes>0?theme.primary:theme.surfaceElevated}/>
            </View>;
          });
        })()}
      </Block>

      {/* Reflect now CTA */}
      <View style={{marginTop:20}}>
        <PrimaryButton full onPress={generateNow}>Reflect now</PrimaryButton>
      </View>

      {/* More details divider */}
      <View style={{flexDirection:'row',alignItems:'center',marginTop:32,marginBottom:14}}>
        <View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:theme.border}}/>
        <Caps color={theme.muted} style={{marginHorizontal:12}}>More details</Caps>
        <View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:theme.border}}/>
      </View>

      {/* How the week went */}
      <Block style={{padding:16}}>
        <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setSelectedDate(new Date());setCurrentMonth(startOfDay(new Date()));}} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',marginBottom:14}}>
          <Caps>Average daily completeness</Caps>
          <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:28,letterSpacing:-0.8,color:theme.text}}>{weeklyAvg}<Text style={{fontSize:14,fontWeight:'500',color:theme.textSecondary}}>%</Text></Text>
        </TouchableOpacity>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',height:90}}>
          {weekly.map(function(w,i){
            var dayOffset=6-i;
            var barDate=addDays(new Date(),-dayOffset);
            var barColor=w.percent>=100?theme.primary:w.percent>=50?theme.accent:theme.danger;
            return <TouchableOpacity key={w.date} activeOpacity={0.7} onPress={function(){haptic('light');setSelectedDate(barDate);setDayDetailDate(barDate);setShowDayDetail(true);}} style={{flex:1,alignItems:'center'}}>
              <View style={{height:Math.max((w.percent/100)*70,4),width:'70%',borderRadius:6,backgroundColor:barColor}}/>
              <Caps color={theme.muted} size={9} ls={0.4} style={{marginTop:6}}>{['M','T','W','T','F','S','S'][i]}</Caps>
            </TouchableOpacity>;
          })}
        </View>
      </Block>

      {/* Past reflections */}
      <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:18,letterSpacing:-0.4,color:theme.text,marginTop:22,marginBottom:8}}>Past reflections</Text>
      <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
        <View style={{flex:1}}><SecondaryButton full onPress={function(){setHistoryOpen(true);}}>{selectedHistoryDate?selectedHistoryDate:'Filter by date'}</SecondaryButton></View>
        {selectedHistoryDate?<View style={{flex:0.6}}><SecondaryButton full onPress={function(){setSelectedHistoryDate('');}}>Clear</SecondaryButton></View>:null}
      </View>
      <ModalSheet visible={historyOpen} title="Choose date" onClose={function(){setHistoryOpen(false);}}>
        <DateField label="Reflection date" value={selectedHistoryDate?new Date(selectedHistoryDate):new Date()} onChange={function(d){setSelectedHistoryDate(isoDate(d));setHistoryOpen(false);}} maximumDate={new Date()}/>
        <SecondaryButton full onPress={function(){setHistoryOpen(false);}}>Done</SecondaryButton>
      </ModalSheet>
      {historyList.slice(0,10).map(function(n){
        return <Block key={n.id} style={{padding:14,marginBottom:8}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
            <Caps style={{flex:1,marginRight:8}}>{n.domain||'general'} · {displayDate(n.sent_at)}</Caps>
            <TouchableOpacity onPress={function(){dismissNudge&&dismissNudge(n.id);}} hitSlop={{top:6,bottom:6,left:6,right:6}}>
              <Caps color={theme.accent}>Dismiss</Caps>
            </TouchableOpacity>
          </View>
          <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.text,lineHeight:20}}>{n.nudge_text}</Text>
        </Block>;
      })}
      {historyList.length===0&&<Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted,marginBottom:8}}>No reflections for this date.</Text>}

      {/* What you spend on */}
      <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:18,letterSpacing:-0.4,color:theme.text,marginTop:22,marginBottom:8}}>{memberFilterId?(reflectFilteredMemberName||'Member')+'’s spending':'What you spend on'}</Text>
      <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
        {['week','month','quarter'].map(function(p){
          var sel=analyticsPeriod===p;
          return <TouchableOpacity key={p} style={[z.chip,sel&&z.chipSel]} onPress={function(){haptic('light');setAnalyticsPeriod(p);}}>
            <Text style={[z.chipTx,sel&&z.chipSelTx]}>{p}</Text>
          </TouchableOpacity>;
        })}
      </View>
      {pieData.length>0?<Block style={{padding:14}}>
        <PieChart data={pieData} width={Math.min(Dimensions.get('window').width-56,340)} height={170} accessor="amount" backgroundColor="transparent" paddingLeft="8" chartConfig={{color:function(){return theme.text;}}}/>
      </Block>:<Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted,marginBottom:8}}>No spending data for selected period.</Text>}

      {/* Daily spend bars */}
      <Block style={{padding:14,marginTop:10}}>
        <Caps>What was spent each day this week</Caps>
        <BarChart data={{labels:days.map(function(d){return d.label;}),datasets:[{data:days.map(function(d){return d.value;})}]}} width={Math.min(Dimensions.get('window').width-56,340)} height={180} fromZero yAxisLabel="₹" withInnerLines={false} showBarTops={false} chartConfig={{backgroundGradientFrom:theme.surface,backgroundGradientTo:theme.surface,decimalPlaces:0,color:function(){return theme.primary;},labelColor:function(){return theme.textSecondary;},propsForBackgroundLines:{strokeWidth:0,stroke:'transparent'}}} style={{marginTop:8,borderRadius:8}}/>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:4}}>
          {days.map(function(d,i){
            return <TouchableOpacity key={'spendday'+i} onPress={function(){haptic('light');setDayDetailDate(toDate(d.date));setSelectedDate(toDate(d.date));setShowDayDetail(true);}} style={{flex:1,alignItems:'center',paddingVertical:6}}>
              <Caps color={theme.primary}>{d.label}</Caps>
            </TouchableOpacity>;
          })}
        </View>
      </Block>

      {/* The whole month — Phase 2.4.A: collapsed by default, tap header to expand */}
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setShowWholeMonth(function(v){return !v;});}} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:22,marginBottom:showWholeMonth?8:0}}>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:18,letterSpacing:-0.4,color:theme.text}}>The whole month</Text>
        <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.muted}}>{showWholeMonth?'▼':'▶'}</Text>
      </TouchableOpacity>
      {showWholeMonth?<Block style={{padding:14}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <TouchableOpacity onPress={function(){setCurrentMonth(new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1));}} hitSlop={{top:6,bottom:6,left:6,right:6}}>
            <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.primary}}>‹ Prev</Text>
          </TouchableOpacity>
          <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.text}}>{currentMonth.toLocaleString('en-IN',{month:'long',year:'numeric'})}</Text>
          <TouchableOpacity onPress={function(){setCurrentMonth(new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1));}} hitSlop={{top:6,bottom:6,left:6,right:6}}>
            <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.primary}}>Next ›</Text>
          </TouchableOpacity>
        </View>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
          {['M','T','W','T','F','S','S'].map(function(d,idx){
            return <Caps key={d+'_'+idx} color={theme.muted} style={{width:'14%',textAlign:'center'}}>{d}</Caps>;
          })}
        </View>
        <View style={{flexDirection:'row',flexWrap:'wrap'}}>
          {monthCells.map(function(cell){
            var d=cell.dateObj;
            var inMonth=d.getMonth()===currentMonth.getMonth();
            var dotColor=cell.percent>=100?theme.primary:cell.percent>=50?theme.accent:theme.danger;
            var isSel=isoDate(d)===selectedISO;
            return <TouchableOpacity key={cell.date} style={[z.calCell,{backgroundColor:isSel?theme.primaryLight:'transparent',borderColor:isSel?theme.primary:'transparent'}]}
              onPress={function(){
                if(isSel){haptic('light');setDayDetailDate(d);setShowDayDetail(true);}
                else{haptic('light');setSelectedDate(d);}
              }}
              onLongPress={function(){haptic('medium');setDayDetailDate(d);setSelectedDate(d);setShowDayDetail(true);}}
              delayLongPress={300}
            >
              <Text style={[z.calCellTx,{color:inMonth?theme.text:theme.muted}]}>{d.getDate()}</Text>
              <View style={[z.calDot,{backgroundColor:dotColor}]}/>
            </TouchableOpacity>;
          })}
        </View>
        <Caps color={theme.muted} style={{marginTop:8,textAlign:'center'}}>Tap a day to select. Tap again or long-press to see the day in detail.</Caps>
      </Block>:null}

      {/* On this day */}
      <TouchableOpacity activeOpacity={0.7} onPress={function(){haptic('light');setDayDetailDate(selectedDate);setShowDayDetail(true);}} style={{marginTop:10}}>
        <Block style={{padding:14}}>
          <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.text}}>On this day: {displayDate(selectedDate)}</Text>
          <Caps color={theme.muted} style={{marginTop:4}}>Captured: {selectedSummary.completed}/5 ({selectedSummary.percent}%)</Caps>
          <Caps color={theme.muted} style={{marginTop:2}}>Entries: {selectedTx.length} · Meals: {selectedMeals.length} · Body logs: {selectedWell.length}</Caps>
          <Caps color={theme.primary} style={{marginTop:8}}>Open day in detail ›</Caps>
        </Block>
      </TouchableOpacity>

      {/* Things due soon */}
      <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:18,letterSpacing:-0.4,color:theme.text,marginTop:22,marginBottom:8}}>Things due soon</Text>
      {upcomingRecurring.map(function(r){
        return <TouchableOpacity activeOpacity={0.7} key={r.id} onPress={function(){
          var related=(transactions||[]).find(function(t){return t.recurring_transaction_id===r.id;});
          if(related){haptic('light');setEditTx(related);}
          else{
            haptic('light');
            var stub={id:null,merchant:r.description,amount:r.amount,category:r.category||'',date:r.next_due_date,recurring_transaction_id:r.id};
            setEditTx(stub);
          }
        }} style={{marginBottom:8}}>
          <Block style={{padding:14}}>
            <View style={{flexDirection:'row',justifyContent:'space-between'}}>
              <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.text}}>{r.description}</Text>
              <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.text}}>₹{fmt(r.amount)}</Text>
            </View>
            <Caps color={theme.muted} style={{marginTop:4}}>Due: {displayDate(r.next_due_date)} · {r.frequency}</Caps>
          </Block>
        </TouchableOpacity>;
      })}
      {upcomingRecurring.length===0&&<Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted,marginBottom:8}}>Nothing due in the next 7 days.</Text>}

      <View style={{height:32}}/>
    </ScrollView>

    <TrendDetailModal visible={!!trendModal} onClose={function(){setTrendModal(null);}}
      kind={trendModal&&trendModal.kind}
      data={trendModal&&trendModal.kind==='spend'?txTrend:proteinTrend}
      labels={['6d','5d','4d','3d','2d','1d','Today']}
    />
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
  var{familyId,familyName,setFamilyName,members,transactions,meals,wellness,scores,streaks,isAdmin,userId,sharedGoals,sharedGoalContributions,activityFeed,refreshSharedGoals,refreshSharedGoalContributions,refreshActivityFeed,refreshTransactions,refreshMeals,refreshWellness,refreshMembers,setQuickAction,openSettings,promises,promiseCommitments,promiseSnapshots,promiseReflections,refreshPromises,refreshPromiseCommitments,confirmPromiseCommitment,declinePromiseCommitment,memberProfiles,currentUserName}=useApp();
  function rname(m){return resolveMemberName(m,memberProfiles,userId,currentUserName);}
  var now=new Date();var today=isoDate(now);
  var monday=mondayOfWeek(now);
  var[inviteSheet,setInviteSheet]=useState(null); // B7: holds the member whose invite modal is open
  var[showInvitePicker,setShowInvitePicker]=useState(false); // Phase 2.5.A: "+ Invite" → picker sheet
  var[showSharedGoalModal,setShowSharedGoalModal]=useState(false);
  var[activeSharedGoal,setActiveSharedGoal]=useState(null);
  var[showNewPromise,setShowNewPromise]=useState(false);
  var[activePromiseDetail,setActivePromiseDetail]=useState(null);
  var[pendingReflection,setPendingReflection]=useState(null);
  var[editingCommitment,setEditingCommitment]=useState(null);

  // Phase D: surface a reflection sheet when a Promise has
  // transitioned in the last 7 days AND the user was a participant
  // AND no reflection from this user exists yet. One at a time —
  // if multiple Promises ended, we show the most recent first;
  // user can skip and the next one appears next open.
  useEffect(function(){
    if(!promises||!promiseCommitments||!userId)return;
    if(pendingReflection)return;

    var sevenDaysAgo=new Date(Date.now()-7*86400000);

    var candidates=(promises||[])
      .filter(function(p){
        return['complete','wound_down','cancelled'].indexOf(p.status)>=0;
      })
      .filter(function(p){
        var updated=new Date(p.updated_at);
        return updated>=sevenDaysAgo;
      })
      .filter(function(p){
        return(promiseCommitments||[]).some(function(c){
          return c.promise_id===p.id&&c.user_id===userId;
        });
      })
      .filter(function(p){
        return!(promiseReflections||[]).some(function(r){
          return r.promise_id===p.id&&r.user_id===userId;
        });
      })
      .sort(function(a,b){
        return new Date(b.updated_at)-new Date(a.updated_at);
      });

    if(candidates.length>0){
      var t=setTimeout(function(){
        setPendingReflection(candidates[0]);
      },600);
      return function(){clearTimeout(t);};
    }
  },[promises,promiseCommitments,promiseReflections,userId]);
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

  // B6: This week's scores per member, summed from the family_scores table
  var thisWeekScores=(scores||[]).filter(function(s){var d=new Date(s.date);return d>=monday;});
  var prevWeekScores=(scores||[]).filter(function(s){var d=new Date(s.date);var wk=new Date(monday);wk.setDate(wk.getDate()-7);return d>=wk && d<monday;});
  var ptsForMember=function(mid,arr){return(arr||[]).filter(function(s){return s.member_id===mid;}).reduce(function(sum,s){return sum+(s.points_earned||0);},0);};
  var familyBonusPts=(thisWeekScores||[]).filter(function(s){return s.member_id==='family';}).reduce(function(sum,s){return sum+(s.points_earned||0);},0);
  var totalScore=(members||[]).reduce(function(sum,m){return sum+ptsForMember(m.id,thisWeekScores);},0)+familyBonusPts;
  var prevTotalScore=(members||[]).reduce(function(sum,m){return sum+ptsForMember(m.id,prevWeekScores);},0);
  var deltaFromLastWeek=totalScore-prevTotalScore;

  // Unique days since Monday with any activity for the given member, capped at 7
  function daysHitInWeek(mid){
    var hits={};
    (meals||[]).forEach(function(ml){if(ml.memberId===mid){var d=isoDate(ml.date);if(new Date(d)>=monday)hits[d]=1;}});
    (transactions||[]).forEach(function(t){if(t.memberId===mid&&t.confirmed){var d=isoDate(t.date);if(new Date(d)>=monday)hits[d]=1;}});
    (wellness||[]).forEach(function(w){if(w.memberId===mid&&new Date(w.date)>=monday)hits[w.date]=1;});
    return Math.min(Object.keys(hits).length,7);
  }

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
    var roleDisplay=isAdminRole?(roleLabel+' · Admin'):roleLabel;
    var initials=(m.name||'').split(' ').filter(Boolean).map(function(p){return p.charAt(0);}).slice(0,2).join('').toUpperCase()||'?';
    return{id:m.id,name:m.name,role:roleDisplay,isAdminRole:isAdminRole,pts:weekPts,streak:topStreak,daily:dM+dT+dW,max:3,color:CARD_BG[i%5],joined:joined,isCurrentUser:isCurrentUser,inviteCode:m.inviteCode,inviteExpiresAt:m.inviteExpiresAt,initials:initials,hit:daysHitInWeek(m.id)+'/7'};
  });

  // Featured shared goal: prefer the highest-progress not-yet-complete; fall back to most recent.
  var featuredSharedGoal=(function(){
    var arr=(sharedGoals||[]).slice();
    if(arr.length===0)return null;
    var inProgress=arr.filter(function(g){return Number(g.current_amount||0)<Number(g.target_amount||0);});
    if(inProgress.length>0){
      inProgress.sort(function(a,b){
        var ap=Number(a.target_amount)>0?Number(a.current_amount||0)/Number(a.target_amount):0;
        var bp=Number(b.target_amount)>0?Number(b.current_amount||0)/Number(b.target_amount):0;
        return bp-ap;
      });
      return inProgress[0];
    }
    return arr[0];
  })();

  // Latest 5 activities (any date) — design has no date filter.
  var latestActivities=(activityFeed||[]).slice(0,5);
  function activityActorColor(name){
    var idx=(members||[]).findIndex(function(m){return m.name===name;});
    return idx>=0?CARD_BG[idx%5]:theme.primary;
  }

  return(<View style={{flex:1,paddingTop:ins.top,backgroundColor:theme.bg}}>
    <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg}/>
    {inviteSheet&&<InviteModal member={inviteSheet} familyId={familyId} familyName={familyName} onClose={function(){setInviteSheet(null);}}/>}
    {/* Phase 2.5.A: invite picker — list all pending members; tap row to open InviteModal for that one */}
    <ModalSheet visible={showInvitePicker} title="Invite who?" onClose={function(){setShowInvitePicker(false);}}>
      {(function(){
        var pending=(memberScores||[]).filter(function(c){return !c.joined && c.id!==creatorMemberId;});
        if(pending.length===0)return <View>
          <Text style={{fontFamily:FF.sans,fontSize:14,lineHeight:21,color:theme.textSecondary,marginBottom:18}}>No pending members. Add new ones from Settings → Family.</Text>
          <PrimaryButton full onPress={function(){setShowInvitePicker(false);if(openSettings)openSettings();}}>Open Settings</PrimaryButton>
        </View>;
        return <View>
          {pending.map(function(c){
            return <TouchableOpacity key={c.id} activeOpacity={0.7} onPress={function(){haptic('light');setShowInvitePicker(false);setInviteSheet(c);}} style={{
              flexDirection:'row',alignItems:'center',
              paddingVertical:12,paddingHorizontal:14,marginBottom:6,
              backgroundColor:theme.surface,
              borderRadius:14,
              borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,
            }}>
              <Avatar name={c.name||'?'} color={c.color} size={32}/>
              <View style={{flex:1,marginLeft:12}}>
                <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.text}}>{c.name||'Unknown'}</Text>
                <Text style={{fontFamily:FF.sans,fontSize:11,color:theme.textSecondary,marginTop:1}}>{c.role}</Text>
              </View>
              <Text style={{fontFamily:FF.sansBold,fontSize:14,color:theme.primary}}>›</Text>
            </TouchableOpacity>;
          })}
        </View>;
      })()}
    </ModalSheet>
    <SharedGoalModal visible={showSharedGoalModal} onClose={function(){setShowSharedGoalModal(false);setActiveSharedGoal(null);}} goal={activeSharedGoal}/>
    <NewPromiseModal visible={showNewPromise} onClose={function(){setShowNewPromise(false);}} onCreated={function(){}}/>
    <PromiseDetailModal promise={activePromiseDetail} onClose={function(){setActivePromiseDetail(null);}}/>
    <PromiseReflectionModal promise={pendingReflection} onClose={function(){setPendingReflection(null);}} onSubmitted={function(){}}/>
    <InvitationConfirmModal
      commitment={editingCommitment}
      promise={editingCommitment?(promises||[]).find(function(p){return p.id===editingCommitment.promise_id;}):null}
      onClose={function(){setEditingCommitment(null);}}/>
    <RenameFamilyModal visible={showRename} onClose={function(){setShowRename(false);}} familyId={familyId} currentName={familyName} onRenamed={function(newName){setFamilyName&&setFamilyName(newName);}}/>
    <MemberDetailModal visible={!!memberDetail} member={memberDetail} onClose={function(){setMemberDetail(null);}}
      onJumpProtein={function(m){setMemberDetail(null);setQuickAction&&setQuickAction({action:'focus_member',memberName:m.name,nonce:Date.now()});navigation.navigate('Wellness');}}
      onJumpScreens={function(m){setMemberDetail(null);setQuickAction&&setQuickAction({action:'focus_member',memberName:m.name,nonce:Date.now()});navigation.navigate('Wellness');}}
      onJumpStreak={function(m){setMemberDetail(null);setScoreScope({scope:'member',member:m});}}
      onJumpScoreBreakdown={function(m){setMemberDetail(null);setScoreScope({scope:'member',member:m});}}
      onJumpToday={function(m){setMemberDetail(null);}}
    />
    <ScoreBreakdownModal visible={!!scoreScope} onClose={function(){setScoreScope(null);}} scope={scoreScope&&scoreScope.scope} member={scoreScope&&scoreScope.member}/>

    <ScrollView style={z.fl} contentContainerStyle={{paddingHorizontal:18,paddingTop:8,paddingBottom:32}} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.primary} colors={[theme.primary]}/>}
    >
      {/* Header */}
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',paddingTop:8,marginBottom:14}}>
        <View style={{flex:1,marginRight:12}}>
          <Caps>Family</Caps>
          <TouchableOpacity activeOpacity={isAdmin?0.7:1} onPress={function(){if(isAdmin){haptic('light');setShowRename(true);}}}>
            <Text style={{fontFamily:FF.serif,fontSize:30,letterSpacing:-0.8,color:theme.text,marginTop:6}} numberOfLines={1}>{familyName||'Your family'}{isAdmin?' ✎':''}</Text>
          </TouchableOpacity>
        </View>
        {isAdmin&&<TouchableOpacity hitSlop={{top:8,bottom:8,left:8,right:8}} onPress={function(){haptic('light');setShowInvitePicker(true);}}>
          <Caps color={theme.primary} ls={0.4}>+ Invite</Caps>
        </TouchableOpacity>}
      </View>

      {/* Hero score */}
      <View style={{position:'relative'}}>
      <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setScoreScope({scope:'family'});}}>
        <Block bg={theme.primary} style={{padding:22}}>
          <Caps color="rgba(255,255,255,0.7)">Family score this week</Caps>
          <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:52,letterSpacing:-2,color:'#fff',lineHeight:54,marginTop:8}}>{fmt(totalScore)}</Text>
          <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:12}}>
            <Text style={{fontFamily:FF.sans,fontSize:12,color:'rgba(255,255,255,0.85)'}}>{deltaFromLastWeek===0?'Same as last week':(deltaFromLastWeek>0?'+':'')+deltaFromLastWeek+' vs last week'}</Text>
            <Text style={{fontFamily:FF.sans,fontSize:12,color:'rgba(255,255,255,0.85)'}}>Tap for breakdown ›</Text>
          </View>
        </Block>
      </TouchableOpacity>
      {/* Phase 2.5.B: InfoIcon — absolute-positioned sibling so its tap doesn't bubble to the score-breakdown TouchableOpacity */}
      <InfoIcon
        title="How the family score works"
        body={"Your family score grows as everyone logs their day:\n\n• Logging a meal: 10 pts (cap 30/day)\n• Logging an activity: 10 pts (cap 30/day)\n• Hitting your protein target: 25 pts\n• Hitting your water target: 15 pts\n• Screen time under limit: 15 pts\n• Confirming all pending money entries: 20 pts\n• Logging a transaction: 5 pts (cap 25/day)\n• Contributing to a goal: 10 pts (cap 20/day)\n\nStreak bonuses kick in at 3 days (+10), 7 days (+25), and 30 days (+100). Goal completions add 50 (halfway) and 150 (done). Activity logging boosts your score but does NOT count toward your daily streak — rest days are okay.\n\nScores reset weekly. Tap the hero for a member-by-member breakdown."}
        color="rgba(255,255,255,0.7)"
        style={{position:'absolute',top:18,right:18}}
      />
      </View>

      {/* Members — vertical stack of MemberStreakRing cards per design source */}
      <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:18,letterSpacing:-0.4,color:theme.text,marginTop:22,marginBottom:10}}>Members</Text>
      <View>
        {memberScores.map(function(c){
          var memObj=members.find(function(m){return m.id===c.id;});
          return <MemberStreakRing key={c.id} member={{
            initials:c.initials,
            name:c.name||'Unknown',
            role:c.role,
            score:c.pts,
            streak:c.streak,
            best:Math.max(c.streak,7),
            hit:c.hit,
            isYou:c.isCurrentUser,
          }} onPress={function(){haptic('light');if(memObj)setMemberDetail(memObj);}}/>;
        })}
      </View>

      {/* Activity feed */}
      <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:18,letterSpacing:-0.4,color:theme.text,marginTop:22,marginBottom:10}}>What’s been happening</Text>
      {latestActivities.length>0?<Block style={{padding:14}}>
        {latestActivities.map(function(a,i,arr){
          var data=a&&a.activity_data?a.activity_data:{};
          var actorName=data.user_name||'Someone';
          var isLast=i===arr.length-1;
          return <View key={a.id} style={{flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomWidth:isLast?0:StyleSheet.hairlineWidth,borderBottomColor:theme.border}}>
            <Avatar name={actorName} color={activityActorColor(actorName)} size={28}/>
            <View style={{flex:1,marginLeft:10}}>
              <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.text,lineHeight:18}}>{buildActivityMessage(a)}</Text>
              <Caps color={theme.muted} style={{marginTop:2}}>{relativeTime(a.created_at)}</Caps>
            </View>
          </View>;
        })}
      </Block>:<Block style={{padding:14}}>
        <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted}}>Nothing’s happened in your family yet.</Text>
        <Caps color={theme.muted} style={{marginTop:6}}>Capture a meal or money entry and it’ll show up here.</Caps>
      </Block>}

      {(function(){
        var myPendingCommitments=(promiseCommitments||[]).filter(function(c){
          return c.user_id===userId&&c.commitment_status==='pending';
        });
        if(myPendingCommitments.length===0)return null;
        return <View>
          <Sec>Promises waiting on you</Sec>
          {myPendingCommitments.map(function(c){
            var p=(promises||[]).find(function(pp){return pp.id===c.promise_id;});
            if(!p)return null;
            var creator=(members||[]).find(function(m){return m.userId===p.created_by;});
            var creatorName=creator?rname(creator):'Someone';
            return <View key={c.id} style={[z.card,{marginBottom:8,borderWidth:1,borderColor:theme.primary}]}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'}}>
                <View style={{flex:1}}>
                  <Text style={[z.txM,{color:theme.text}]}>{p.title}</Text>
                  <Text style={[z.cap,{color:theme.muted,marginTop:2}]}>
                    from {creatorName} {'·'} {displayDate(p.start_date)} to {displayDate(p.end_date)}
                  </Text>
                </View>
              </View>
              <Text style={[z.body,{color:theme.text,marginTop:8}]}>
                {'"'}{c.commitment_text}{'"'}
              </Text>
              <View style={{flexDirection:'row',gap:8,marginTop:12}}>
                <TouchableOpacity
                  style={{flex:1,padding:10,borderRadius:8,
                          backgroundColor:theme.primary,alignItems:'center'}}
                  onPress={function(){
                    Alert.alert('Confirm this?',
                      'Take this on as written. You can mark it done later or edit if needed.',
                      [
                        {text:'Cancel',style:'cancel'},
                        {text:'Confirm',onPress:function(){
                          if(confirmPromiseCommitment)confirmPromiseCommitment(c.id);
                        }}
                      ]
                    );
                  }}>
                  <Text style={{color:'#fff',fontWeight:'500',fontSize:13}}>Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{flex:1,padding:10,borderRadius:8,
                          borderWidth:1,borderColor:theme.primary,alignItems:'center'}}
                  onPress={function(){setEditingCommitment(c);}}>
                  <Text style={{color:theme.primary,fontWeight:'500',fontSize:13}}>Edit & confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{flex:1,padding:10,alignItems:'center'}}
                  onPress={function(){
                    Alert.alert('Decline?',
                      'You can pass on this one. The promise still goes ahead for whoever confirms.',
                      [
                        {text:'Cancel',style:'cancel'},
                        {text:'Decline',style:'destructive',onPress:function(){
                          if(declinePromiseCommitment)declinePromiseCommitment(c.id);
                        }}
                      ]
                    );
                  }}>
                  <Text style={{color:theme.muted,fontWeight:'500',fontSize:13}}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>;
          })}
        </View>;
      })()}

      <Sec>Promises in motion</Sec>
      {(promises||[]).filter(function(p){return p.status==='active';}).length>0
        ?(function(){
          function latestSnapshot(commitmentId){
            var snaps=(promiseSnapshots||[]).filter(function(s){return s.commitment_id===commitmentId;});
            if(snaps.length===0)return null;
            snaps.sort(function(a,b){return a.snapshot_date<b.snapshot_date?1:-1;});
            return snaps[0];
          }
          return (promises||[]).filter(function(p){return p.status==='active';}).slice(0,5).map(function(p){
            var pCommits=(promiseCommitments||[]).filter(function(c){return c.promise_id===p.id;});
            var totalDays=Math.max(1,Math.ceil((new Date(p.end_date)-new Date(p.start_date))/86400000));
            var elapsedDays=Math.max(0,Math.min(totalDays,Math.ceil((new Date()-new Date(p.start_date))/86400000)));
            var pctElapsed=totalDays>0?elapsedDays/totalDays:0;
            return <TouchableOpacity key={p.id} style={[z.card,{backgroundColor:theme.surface,borderColor:theme.border,marginBottom:8}]}
              onPress={function(){setActivePromiseDetail(p);}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <Text style={[z.txM,{color:theme.text,flex:1,paddingRight:8}]}>{p.title}</Text>
                <Text style={[z.cap,{color:theme.primary}]}>Active</Text>
              </View>
              <Text style={[z.cap,{color:theme.muted,marginTop:2,marginBottom:8}]}>
                {displayDate(p.start_date)} to {displayDate(p.end_date)} {'·'} {elapsedDays} of {totalDays} days
              </Text>
              {pCommits.slice(0,4).map(function(c){
                var member=(members||[]).find(function(m){return m.id===c.member_id;});
                var name=rname(member);
                var text=c.commitment_text&&c.commitment_text.length>60
                  ?c.commitment_text.slice(0,57)+'...'
                  :(c.commitment_text||'');
                var snap=latestSnapshot(c.id);

                if(c.commitment_type==='custom'||!snap||snap.progress_target===null){
                  return <View key={c.id} style={{marginBottom:6}}>
                    <Text style={[z.body,{color:theme.text}]}>{name}{': "'}{text}{'"'}</Text>
                    {c.manually_marked_done
                      ?<Text style={[z.cap,{color:theme.primary}]}>marked done</Text>
                      :<Text style={[z.cap,{color:theme.muted}]}>in progress</Text>}
                  </View>;
                }

                var pctProgress=snap.progress_target>0
                  ?Math.min(1,snap.progress_value/snap.progress_target)
                  :0;
                var atRisk=pctElapsed>0.5&&pctProgress<0.5;
                var barColor=atRisk?theme.accent:theme.primary;

                return <View key={c.id} style={{marginBottom:6}}>
                  <Text style={[z.body,{color:theme.text}]}>{name}{': "'}{text}{'"'}</Text>
                  <View style={{height:6,backgroundColor:'#E8E5DD',borderRadius:3,marginTop:4,overflow:'hidden'}}>
                    <View style={{height:6,width:(pctProgress*100)+'%',backgroundColor:barColor}}/>
                  </View>
                  <Text style={[z.cap,{color:theme.muted,marginTop:2}]}>
                    {snap.progress_value} of {snap.progress_target}
                    {atRisk?' · catching up':''}
                  </Text>
                </View>;
              })}
            </TouchableOpacity>;
          });
        })()
        :<Text style={[z.cap,{color:theme.muted}]}>No promises yet. The first one starts when you make it with someone.</Text>
      }
      <View style={{alignSelf:'flex-start',marginTop:8,marginBottom:16}}>
        <PrimaryButton onPress={function(){setShowNewPromise(true);}}>+ New promise</PrimaryButton>
      </View>

      {/* Shared goal — single accent block per design. Tap → SharedGoalModal (view/edit/contribute). Multi-goal management lives on Finance tab. */}
      {featuredSharedGoal?(function(){
        var g=featuredSharedGoal;
        var pct=Number(g.target_amount)>0?Math.round((Number(g.current_amount||0)/Number(g.target_amount))*100):0;
        var done=pct>=100;
        return <TouchableOpacity activeOpacity={0.85} onPress={function(){haptic('light');setActiveSharedGoal(g);setShowSharedGoalModal(true);}} style={{marginTop:12}}>
          <Block bg={theme.accent} style={{padding:22}}>
            <Caps color="rgba(255,255,255,0.75)">Shared goal · {g.goal_name}</Caps>
            <View style={{flexDirection:'row',alignItems:'baseline',marginTop:8}}>
              <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:36,letterSpacing:-1.4,color:'#fff',lineHeight:38}}>₹{fmt(g.current_amount||0)}</Text>
              <Text style={{fontFamily:FF.sans,fontWeight:'500',fontSize:14,color:'rgba(255,255,255,0.8)',marginLeft:6}}>/ ₹{fmt(g.target_amount||0)}</Text>
            </View>
            <View style={{marginTop:12}}>
              <Progress value={Math.min(pct,100)} color="#fff" track="rgba(255,255,255,0.25)"/>
            </View>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:10}}>
              <Text style={{fontFamily:FF.sans,fontSize:12,color:'rgba(255,255,255,0.85)'}}>{pct}% there{(sharedGoals||[]).length>1?' · '+((sharedGoals||[]).length-1)+' more':''}</Text>
              <Text style={{fontFamily:FF.sans,fontSize:12,color:'rgba(255,255,255,0.85)'}}>{done?'🎉 Completed':'Tap to manage ›'}</Text>
            </View>
          </Block>
        </TouchableOpacity>;
      })():<Caps color={theme.muted} style={{marginTop:14}}>No shared goals yet. Start one from the Finance tab.</Caps>}

      <View style={{height:32}}/>
    </ScrollView>
  </View>);
}

// B7: Invite sheet — shown to admin when they tap "Invite [Name]". Generates a 6-char code
// tied to that member slot, copies to clipboard, and offers native share sheet.
function InviteModal({member,familyId,familyName,onClose}){
  var theme=useThemeColors();
  var[code,setCode]=useState('');
  var[loading,setLoading]=useState(false);
  // Phase A3: invite-time tier picker. Default 'member' (safer); creator/co-admin elevates to 'co_admin'.
  var[accessRoleChoice,setAccessRoleChoice]=useState('member');

  async function generate(){
    haptic('light');
    setLoading(true);
    try{
      var newCode=generateInviteCode();
      var existing=await supabase.from('family_invites').select('id').eq('family_id',familyId).eq('invited_member_name',member.name).eq('status','pending').maybeSingle();
      if(existing&&existing.data&&existing.data.id){
        var upd=await supabase.from('family_invites').update({invite_code:newCode,invited_access_role:accessRoleChoice}).eq('id',existing.data.id);
        if(upd.error)throw upd.error;
      }else{
        var ins=await supabase.from('family_invites').insert({
          family_id:familyId,
          invited_by:member.userId||null,
          invite_code:newCode,
          invited_member_name:member.name||'Member',
          invited_member_role:(member.role||'parent').toLowerCase(),
          invited_access_role:accessRoleChoice,
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

  function TierOption(props){
    var sel=accessRoleChoice===props.value;
    return <TouchableOpacity onPress={function(){haptic('light');setAccessRoleChoice(props.value);}} style={{
      flexDirection:'row',alignItems:'flex-start',
      paddingVertical:12,paddingHorizontal:14,marginBottom:8,
      borderRadius:14,backgroundColor:sel?theme.primaryLight:theme.surface,
      borderWidth:StyleSheet.hairlineWidth,borderColor:sel?theme.primary:theme.border,
    }}>
      <View style={{width:18,height:18,borderRadius:9999,borderWidth:1.5,borderColor:sel?theme.primary:theme.muted,marginRight:10,marginTop:2,alignItems:'center',justifyContent:'center'}}>
        {sel?<View style={{width:8,height:8,borderRadius:9999,backgroundColor:theme.primary}}/>:null}
      </View>
      <View style={{flex:1}}>
        <Text style={{fontFamily:FF.sansSemi,fontSize:14,color:sel?theme.primary:theme.text}}>{props.title}</Text>
        <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.textSecondary,marginTop:3,lineHeight:17}}>{props.desc}</Text>
      </View>
    </TouchableOpacity>;
  }
  var tierLabel=accessRoleChoice==='co_admin'?'Co-admin':'Member';

  return(<ModalSheet visible={true} title={'Invite '+member.name} onClose={onClose}>
    <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,marginBottom:16,lineHeight:20}}>Share this code with {member.name}. They'll enter it on signup to join the {familyName||'family'}.</Text>
    {!code?<View style={{marginBottom:16}}>
      <Text style={{fontFamily:FF.sansSemi,fontSize:13,color:theme.text,marginBottom:8,letterSpacing:0.2}}>Permission tier</Text>
      <TierOption value="co_admin" title="Co-admin" desc="Can log and edit data for the whole family. Use for spouses, partners, second adults."/>
      <TierOption value="member" title="Member" desc="Can only edit their own meals, transactions, wellness logs. Use for kids, grandparents, or anyone who manages just their own data."/>
    </View>:null}
    {code?<View>
      <Block bg={theme.primary} style={{alignItems:'center',paddingVertical:24,marginBottom:14}}>
        <Caps color="rgba(255,255,255,0.7)">Invite code · {tierLabel}</Caps>
        <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:42,letterSpacing:8,color:'#fff',marginTop:8}}>{code}</Text>
        <Caps color="rgba(255,255,255,0.7)" style={{marginTop:8}}>Expires in 7 days</Caps>
      </Block>
      <View style={{flexDirection:'row',gap:10,marginBottom:12}}>
        <View style={{flex:1}}><SecondaryButton full onPress={copyCode}>Copy</SecondaryButton></View>
        <View style={{flex:1.4}}><PrimaryButton full onPress={shareCode}>Share via…</PrimaryButton></View>
      </View>
      <TouchableOpacity onPress={generate} disabled={loading} style={{alignItems:'center',paddingVertical:8}}>
        <Caps color={theme.muted}>{loading?'Generating…':'Generate a new code'}</Caps>
      </TouchableOpacity>
    </View>:<PrimaryButton full disabled={loading} onPress={generate}>{loading?'Generating…':'Generate invite code'}</PrimaryButton>}
    <View style={{marginTop:8}}><SecondaryButton full onPress={onClose}>Close</SecondaryButton></View>
  </ModalSheet>);
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
  return(<ModalSheet visible={visible} title="Rename your family" onClose={onClose}>
    <Inp label="Family name" value={name} onChangeText={setName} placeholder="Our Family" maxLength={48}/>
    <View style={{flexDirection:'row',gap:10,marginTop:8}}>
      <View style={{flex:1}}><SecondaryButton full onPress={onClose}>Cancel</SecondaryButton></View>
      <View style={{flex:1.4}}><PrimaryButton full disabled={!name.trim()||saving} onPress={save}>{saving?'Saving…':'Save'}</PrimaryButton></View>
    </View>
  </ModalSheet>);
}

// Member detail — opened by tapping a member chip on Family / Settings / Wellness
// Shows weekly stats for that member + jump-to-detail buttons.
function MemberDetailModal({visible,onClose,member,onJumpProtein,onJumpScreens,onJumpStreak,onJumpScoreBreakdown,onJumpToday}){
  var theme=useThemeColors();
  var{transactions,meals,wellness,scores,streaks,memberProfiles,members}=useApp();
  if(!member)return null;
  var today=isoDate(new Date());
  var monday=mondayOfWeek(new Date());
  var weekMeals=(meals||[]).filter(function(m){return m.memberId===member.id&&toDate(m.date)>=monday;});
  var todayMeals=(meals||[]).filter(function(m){return m.memberId===member.id&&isoDate(m.date)===today;});
  var profile=(memberProfiles&&member.userId)?memberProfiles[member.userId]:null;
  var targets=calculateProteinTargets(profile&&profile.weightKg?profile.weightKg:null);
  // Screen time + sleep: filter to rows where the metric is non-null (post-migration,
  // NULL = "not logged"; explicit 0 still counts as a log).
  var weekScreens=(wellness||[]).filter(function(w){var v=typeof w.screenHrs!=='undefined'?w.screenHrs:w.screen_hrs;return w.memberId===member.id&&toDate(w.date)>=monday&&v!==null&&typeof v!=='undefined';});
  var weekScreenHrs=weekScreens.reduce(function(s,w){return s+Number(w.screenHrs||w.screen_hrs||0);},0);
  var weekSleeps=(wellness||[]).filter(function(w){return w.memberId===member.id&&toDate(w.date)>=monday&&w.sleep_hours!==null&&typeof w.sleep_hours!=='undefined';});
  var weekSleepHrs=weekSleeps.reduce(function(s,w){return s+Number(w.sleep_hours||0);},0);
  var memScores=(scores||[]).filter(function(s){return s.member_id===member.id&&toDate(s.date)>=monday;});
  var weekPts=memScores.reduce(function(s,r){return s+(r.points_earned||0);},0);
  var memStreaks=(streaks||[]).filter(function(s){return s.member_id===member.id;});
  var topStreak=memStreaks.reduce(function(mx,s){return Math.max(mx,s.current_streak||0);},0);
  var weekProtein=weekMeals.reduce(function(s,m){return s+Number(m.protein||0);},0);
  var avgProtein=weekMeals.length>0?Math.round(weekProtein/7):0;
  var avgScreenHrs=weekScreens.length>0?(weekScreenHrs/7):0;
  var avgScreenH=Math.floor(avgScreenHrs);
  var avgScreenM=Math.round((avgScreenHrs-avgScreenH)*60);
  var avatarColor=(function(){
    var idx=(members||[]).findIndex(function(m){return m.id===member.id;});
    return idx>=0?CARD_BG[idx%5]:theme.primary;
  })();
  return(<ModalSheet visible={visible} title="" onClose={onClose}>
    {/* Member header — avatar + serif name + role */}
    <View style={{flexDirection:'row',alignItems:'center',marginBottom:16}}>
      <Avatar name={member.name||'?'} color={avatarColor} size={56}/>
      <View style={{flex:1,marginLeft:14}}>
        <Text style={{fontFamily:FF.serif,fontWeight:'400',fontSize:24,letterSpacing:-0.4,color:theme.text}}>{member.name}</Text>
        <Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,marginTop:2}}>{getMemberRoleDisplay(member)}</Text>
      </View>
    </View>

    {/* 2x2 stat grid */}
    <View style={{flexDirection:'row',gap:8,marginBottom:8}}>
      <View style={{flex:1}}>
        <Block bg={theme.primary} style={{padding:16}}>
          <Caps color="rgba(255,255,255,0.7)">Score this week</Caps>
          <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:28,letterSpacing:-0.8,color:'#fff',marginTop:4}}>{weekPts}</Text>
        </Block>
      </View>
      <View style={{flex:1}}>
        <Block bg={theme.accent} style={{padding:16}}>
          <Caps color="rgba(255,255,255,0.75)">Streak</Caps>
          <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:28,letterSpacing:-0.8,color:'#fff',marginTop:4}}>{topStreak}<Text style={{fontSize:13,fontWeight:'500',color:'rgba(255,255,255,0.85)'}}> days</Text></Text>
        </Block>
      </View>
    </View>
    <View style={{flexDirection:'row',gap:8,marginBottom:16}}>
      <View style={{flex:1}}>
        <Block bg={theme.surfaceElevated} style={{padding:16}}>
          <Caps>Avg protein</Caps>
          <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:22,letterSpacing:-0.6,color:theme.text,marginTop:4}}>{avgProtein}g</Text>
        </Block>
      </View>
      <View style={{flex:1}}>
        <Block bg={theme.surfaceElevated} style={{padding:16}}>
          <Caps>Avg screens</Caps>
          <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:22,letterSpacing:-0.6,color:theme.text,marginTop:4}}>{avgScreenH}h {avgScreenM}m</Text>
        </Block>
      </View>
    </View>

    {/* Jump rows */}
    {[
      {label:"Today's log",detail:todayMeals.length+' meal'+(todayMeals.length===1?'':'s')+' · '+(transactions||[]).filter(function(t){return t.memberId===member.id&&isoDate(t.date)===today;}).length+' entries',onPress:function(){onJumpToday&&onJumpToday(member);}},
      {label:'Score breakdown',detail:'Where '+weekPts+' points came from',onPress:function(){onJumpScoreBreakdown&&onJumpScoreBreakdown(member);}},
      {label:'Protein detail',detail:'Today: '+todayMeals.reduce(function(s,m){return s+Number(m.protein||0);},0)+'g · Target '+targets.active+'g',onPress:function(){onJumpProtein&&onJumpProtein(member);}},
      {label:'Screen time detail',detail:weekScreens.length+' day'+(weekScreens.length===1?'':'s')+' captured · '+weekScreenHrs.toFixed(1)+' hrs total',onPress:function(){onJumpScreens&&onJumpScreens(member);}},
      {label:'Sleep detail',detail:weekSleeps.length>0?(weekSleeps.length+' night'+(weekSleeps.length===1?'':'s')+' captured · avg '+(weekSleepHrs/weekSleeps.length).toFixed(1)+' h'):'No nights logged this week'},
    ].map(function(item,idx){
      return <TouchableOpacity key={idx} activeOpacity={0.7} onPress={item.onPress} style={{
        backgroundColor:theme.surface,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,borderRadius:14,
        paddingVertical:14,paddingHorizontal:16,marginBottom:8,
        flexDirection:'row',justifyContent:'space-between',alignItems:'center',
      }}>
        <View style={{flex:1,marginRight:8}}>
          <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.text}}>{item.label}</Text>
          <Caps color={theme.muted} style={{marginTop:2}}>{item.detail}</Caps>
        </View>
        <Text style={{fontFamily:FF.sans,fontSize:18,color:theme.muted}}>›</Text>
      </TouchableOpacity>;
    })}

    <View style={{height:8}}/>
  </ModalSheet>);
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
  return(<ModalSheet visible={visible} title="Score breakdown" onClose={onClose}>
    <Caps color={theme.textSecondary} style={{marginBottom:14}}>{scope==='family'?'Whole family · this week':((member&&member.name)||'Member')+' · this week'}</Caps>
    <Block bg={theme.primary} style={{padding:20,marginBottom:14}}>
      <Caps color="rgba(255,255,255,0.7)">This week</Caps>
      <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:48,letterSpacing:-1.8,color:'#fff',lineHeight:50,marginTop:6}}>{fmt(totalPts)}<Text style={{fontSize:16,fontWeight:'500',color:'rgba(255,255,255,0.7)'}}> pts</Text></Text>
    </Block>
    <Caps style={{marginBottom:8}}>By category</Caps>
    {typeKeys.length===0&&<Text style={{fontFamily:FF.sans,fontSize:13,color:theme.muted}}>Nothing earned yet this week.</Text>}
    {typeKeys.map(function(k){
      var pct=totalPts>0?(byType[k].pts/totalPts)*100:0;
      return <Block key={k} style={{padding:14,marginBottom:8}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
          <Text style={{fontFamily:FF.sansSemi,fontSize:13,fontWeight:'600',color:theme.text}}>{nicelabel[k]||k}</Text>
          <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:13,color:theme.primary}}>+{byType[k].pts}<Text style={{color:theme.muted,fontWeight:'500'}}> · {byType[k].count}×</Text></Text>
        </View>
        <Progress value={pct}/>
      </Block>;
    })}
    <View style={{height:8}}/>
  </ModalSheet>);
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
  return(<ModalSheet visible={visible} title="Change category" onClose={onClose}>
    <Caps color={theme.textSecondary} style={{marginBottom:12}}>{transaction.merchant} · ₹{fmt(transaction.amount)}</Caps>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14}}>
      {CAT_LIST.map(function(c){
        var sel=transaction.category===c;
        var cc=CATS[c]||CATS.Uncat;
        return <TouchableOpacity key={c} disabled={saving} onPress={function(){haptic('light');pick(c);}} style={{
          paddingVertical:6,paddingHorizontal:12,borderRadius:9999,
          backgroundColor:sel?cc.bg:theme.surfaceElevated,
          borderWidth:sel?1.5:StyleSheet.hairlineWidth,
          borderColor:sel?cc.text:theme.border,
          opacity:saving?0.5:1,
        }}>
          <Text style={{fontFamily:FF.sansSemi,fontSize:12,fontWeight:'600',color:sel?cc.text:theme.textSecondary}}>{c}</Text>
        </TouchableOpacity>;
      })}
    </View>
    <SecondaryButton full onPress={onClose}>Close</SecondaryButton>
  </ModalSheet>);
}

// Trend detail — full-screen view of spend or protein trend
function TrendDetailModal({visible,onClose,kind,data,labels}){
  var theme=useThemeColors();
  if(!visible)return null;
  var width=Math.min(Dimensions.get('window').width-40,360);
  var title=kind==='spend'?'Where spending is heading':'Where protein is heading';
  var unit=kind==='spend'?'₹':'g';
  var max=Math.max.apply(null,(data||[0]).concat([1]));
  var avg=data&&data.length?Math.round(data.reduce(function(a,b){return a+b;},0)/data.length):0;
  return(<ModalSheet visible={visible} title={title} onClose={onClose}>
    <Block style={{padding:14}}>
      <Caps>Daily average over 7 days</Caps>
      <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:30,letterSpacing:-1,color:theme.text,marginTop:6,marginBottom:14}}>{unit}{fmt(avg)}</Text>
      <LineChart
        data={{labels:labels||[],datasets:[{data:data||[0]}]}}
        width={width}
        height={200}
        yAxisLabel={kind==='spend'?'₹':''}
        yAxisSuffix={kind==='protein'?'g':''}
        withInnerLines={false}
        chartConfig={{backgroundGradientFrom:theme.surface,backgroundGradientTo:theme.surface,decimalPlaces:0,color:function(){return theme.primary;},labelColor:function(){return theme.textSecondary;},propsForDots:{r:'3',strokeWidth:'1.5',stroke:theme.primary}}}
        bezier
        style={{borderRadius:8}}
      />
      <Caps color={theme.textSecondary} style={{marginTop:10}}>Peak: {unit}{fmt(max)}</Caps>
    </Block>
  </ModalSheet>);
}

function OurPromiseScreen({onClose}){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var sections=[
    {label:'One',title:'Your family is the unit. Not you alone.',body:'Every other app gives each person a separate dashboard. Yours shows the whole family at once — money, meals, time, goals — so you can finally see the picture instead of guessing at it.'},
    {label:'Two',title:'One nudge a day. Never between 10 PM and 8 AM.',body:'No streaks designed to break you. No gamification. No re-prompts. If you miss a day, the day passes. We will not pull you back into the app to fix a number.'},
    {label:'Three',title:'We are trying to become unnecessary.',body:"After six months you should know your family's spending patterns, eating patterns, and screen patterns by heart. The habits should outlive the app. If they do, we did our job — even if you stop opening this."},
  ];
  return(<View style={{flex:1,paddingTop:ins.top,backgroundColor:theme.bg}}>
    <NavBar title="" trailing={<TouchableOpacity onPress={function(){haptic('light');onClose();}} hitSlop={{top:8,bottom:8,left:8,right:8}}><Caps color={theme.primary} ls={0.4}>Done</Caps></TouchableOpacity>}/>
    <ScrollView style={{flex:1}} contentContainerStyle={{paddingHorizontal:24,paddingTop:16,paddingBottom:60}} showsVerticalScrollIndicator={false}>
      <Caps color={theme.primary}>Our promise</Caps>
      <Text style={{fontFamily:FF.serif,fontWeight:'400',fontSize:32,letterSpacing:-1,color:theme.text,marginTop:12,lineHeight:38}}>
        We are not here to keep{'\n'}<Text style={{fontStyle:'italic'}}>your attention.</Text>{'\n'}We are here to give it back.
      </Text>

      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:theme.border,marginTop:28,marginBottom:8}}/>

      <View style={{marginTop:16}}>
        {sections.map(function(s,i){
          return <View key={s.label} style={{marginBottom:24}}>
            <Caps color={theme.accent} ls={1.0}>{s.label}</Caps>
            <Text style={{fontFamily:FF.serif,fontWeight:'400',fontSize:22,letterSpacing:-0.4,color:theme.text,marginTop:10,lineHeight:28}}>{s.title}</Text>
            <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,marginTop:8,lineHeight:22}}>{s.body}</Text>
          </View>;
        })}
      </View>

      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:theme.border,marginVertical:16}}/>

      <Text style={{fontFamily:FF.serif,fontWeight:'400',fontStyle:'italic',fontSize:18,color:theme.textSecondary,lineHeight:26,marginBottom:8}}>This app is not a tracker. It is a mirror.</Text>
      <Text style={{fontFamily:FF.serif,fontWeight:'400',fontStyle:'italic',fontSize:18,color:theme.textSecondary,lineHeight:26,marginBottom:40}}>Trackers tell you what happened. A mirror shows you what you didn't know was there.</Text>
    </ScrollView>
  </View>);
}

function SettingsScreen({onClose}){
  var ins=useSafeAreaInsets();
  var theme=useThemeColors();
  var themeCtx=useThemeCtx();
  var themeMode=themeCtx&&themeCtx.themeMode?themeCtx.themeMode:'light';
  var setThemeMode=themeCtx&&themeCtx.setThemeMode?themeCtx.setThemeMode:function(){};
  var{familyId,familyName,setFamilyName,members,isAdmin,userId,currentUserName,userProfile,refreshMembers,openQuestionnaire,notificationEnabled,setNotificationEnabled,waterTrackingEnabled,setWaterTrackingEnabled,refreshActivityFeed,silentHoursEnabled,setSilentHoursEnabled,silentHoursStart,setSilentHoursStart,silentHoursEnd,setSilentHoursEnd}=useApp();
  var[silentPicker,setSilentPicker]=useState(null); // 'start' | 'end' | null
  var[inviteSheet,setInviteSheet]=useState(null);
  var[removeConfirm,setRemoveConfirm]=useState(null);
  var[showProfile,setShowProfile]=useState(false);
  var[showOurPromise,setShowOurPromise]=useState(false);
  var[showRename,setShowRename]=useState(false); // S3
  var[memberDetail,setMemberDetail]=useState(null); // S4
  var[showAddMember,setShowAddMember]=useState(false);
  var[newMemberName,setNewMemberName]=useState('');
  var[newMemberRole,setNewMemberRole]=useState('parent');
  var[addingMember,setAddingMember]=useState(false);
  var[debugTaps,setDebugTaps]=useState(0);
  var[debugEnabled,setDebugEnabled]=useState(false);
  var creatorMember=(members||[]).find(function(m){return m.userId===userId;})||((isAdmin&&members&&members.length)?members[0]:null);
  var creatorMemberId=creatorMember?creatorMember.id:null;
  var userInitials=(currentUserName||'?').trim().split(' ').filter(Boolean).slice(0,2).map(function(s){return s.charAt(0).toUpperCase();}).join('')||'?';

  async function removeMember(m){
    try{
      if(m._virtual && m.inviteId){
        var canc=await supabase.from('family_invites').update({status:'cancelled'}).eq('id',m.inviteId).select();
        console.log('[INVITE CANCEL]',{inviteId:m.inviteId,data:canc.data,error:canc.error});
        if(canc.error)throw canc.error;
      }else{
        var res=await supabase.from('family_members').delete().eq('id',m.id).select();
        console.log('[MEMBER UNLINK]',{memberId:m.id,data:res.data,error:res.error});
        if(res.error)throw res.error;
      }
      await refreshMembers();
      haptic('success');
      setRemoveConfirm(null);
    }catch(e){haptic('error');showFriendlyError('Could not update family member',e);}
  }

  // Reusable list-row helper: matches design's flat button rows (label + value or chevron).
  function listRow(label,value,onPress,opts){
    var danger=opts&&opts.danger;
    var emoji=opts&&opts.emoji;
    return <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={{
      backgroundColor:theme.surface,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,borderRadius:12,
      paddingVertical:13,paddingHorizontal:14,marginBottom:6,
      flexDirection:'row',alignItems:'center',
    }}>
      {emoji?<Text style={{fontSize:16,marginRight:10}}>{emoji}</Text>:null}
      <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:14,color:danger?theme.danger:theme.text,flex:1}}>{label}</Text>
      {value?<Text style={{fontFamily:FF.sans,fontWeight:'500',fontSize:13,color:theme.muted}}>{value}</Text>:<Text style={{fontFamily:FF.sans,fontSize:18,color:theme.muted}}>›</Text>}
    </TouchableOpacity>;
  }

  return(<View style={{flex:1,paddingTop:ins.top,backgroundColor:theme.bg}}>
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
    {removeConfirm&&<ModalSheet visible={true} title={'Remove '+removeConfirm.name+'?'} onClose={function(){setRemoveConfirm(null);}}>
      <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,marginBottom:16,lineHeight:20}}>This unlinks their account. Their existing logs stay in the family history.</Text>
      <View style={{flexDirection:'row',gap:10}}>
        <View style={{flex:1}}><SecondaryButton full onPress={function(){setRemoveConfirm(null);}}>Cancel</SecondaryButton></View>
        <View style={{flex:1}}><PrimaryButton full accent onPress={function(){removeMember(removeConfirm);}}>Remove</PrimaryButton></View>
      </View>
    </ModalSheet>}

    <NavBar title="Settings" trailing={<TouchableOpacity onPress={function(){haptic('light');onClose();}} hitSlop={{top:8,bottom:8,left:8,right:8}}><Caps color={theme.primary} ls={0.4}>Done</Caps></TouchableOpacity>}/>

    <ScrollView style={{flex:1}} contentContainerStyle={{padding:16,paddingTop:12,paddingBottom:32}} showsVerticalScrollIndicator={false}>
      {/* Profile card */}
      <TouchableOpacity activeOpacity={0.7} onPress={function(){setShowProfile(true);}}>
        <Block style={{padding:16,marginBottom:14}}>
          <View style={{flexDirection:'row',alignItems:'center'}}>
            <Avatar name={currentUserName||'?'} color={theme.primary} size={48}/>
            <View style={{flex:1,marginLeft:14}}>
              <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:16,color:theme.text}}>{currentUserName||'User'}</Text>
              {userProfile&&userProfile.email?<Text style={{fontFamily:FF.sans,fontSize:13,color:theme.textSecondary,marginTop:2}}>{userProfile.email}</Text>:null}
              {isAdmin&&<View style={{marginTop:6,alignSelf:'flex-start'}}><Pill bg={theme.primaryLight} fg={theme.primary}>Admin · Family</Pill></View>}
            </View>
            <Text style={{fontFamily:FF.sans,fontSize:18,color:theme.muted}}>›</Text>
          </View>
        </Block>
      </TouchableOpacity>

      {/* Family */}
      <Caps style={{marginTop:8,marginBottom:8}}>Family</Caps>
      <Block style={{padding:16,marginBottom:8}}>
        <View style={{flexDirection:'row',alignItems:'center'}}>
          <View style={{
            width:44,height:44,borderRadius:12,backgroundColor:theme.primary,
            alignItems:'center',justifyContent:'center',marginRight:12,
          }}>
            <Text style={{fontFamily:FF.serif,fontWeight:'400',fontSize:22,color:'#fff'}}>{(familyName||'F').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:14,color:theme.text}}>{familyName||'Your family'}</Text>
            <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.textSecondary,marginTop:2}}>{members.length} member{members.length!==1?'':''}{isAdmin?' · You are admin':''}</Text>
          </View>
        </View>
        {isAdmin&&<View style={{flexDirection:'row',gap:8,marginTop:14}}>
          <View style={{flex:1}}><SecondaryButton full onPress={function(){haptic('light');setShowRename(true);}}>Rename</SecondaryButton></View>
        </View>}
      </Block>
      {/* Member list */}
      {members.map(function(m){
        var isSelf=m.userId===userId||m.id===creatorMemberId;
        var status=isSelf?'You':(m.userId?'Joined':(m.inviteCode?'Invite pending':'Not invited'));
        var statusColor=isSelf?theme.primary:(m.userId?theme.primary:(m.inviteCode?theme.accent:theme.muted));
        var roleLabel=getMemberRoleDisplay(m);
        return <TouchableOpacity key={m.id} activeOpacity={0.7} onPress={function(){if(isSelf){haptic('light');setShowProfile(true);}else{haptic('light');setMemberDetail(m);}}}>
          <Block style={{padding:14,marginBottom:8}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <View style={{flex:1}}>
                <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:14,color:theme.text}}>{m.name}</Text>
                <Caps color={theme.muted} style={{marginTop:2}}>{roleLabel}</Caps>
              </View>
              <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:12,color:statusColor}}>{status}</Text>
            </View>
            {isAdmin && !m.userId && m.id!==creatorMemberId && <View style={{marginTop:12}}>
              <SecondaryButton onPress={function(){setInviteSheet(m);}}>{m.inviteCode?'Regenerate code':'Invite'}</SecondaryButton>
            </View>}
            {isAdmin && m.userId && m.userId!==userId && <TouchableOpacity style={{marginTop:12,alignSelf:'flex-start'}} onPress={function(){setRemoveConfirm(m);}}>
              <Caps color={theme.danger}>Remove from family</Caps>
            </TouchableOpacity>}
          </Block>
        </TouchableOpacity>;
      })}
      {isAdmin&&<TouchableOpacity style={{flexDirection:'row',alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border,borderStyle:'dashed',borderRadius:14,paddingVertical:14,marginBottom:8,backgroundColor:'transparent'}} onPress={function(){haptic('light');setShowAddMember(true);}}>
        <Text style={{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:theme.primary}}>+ Add Member</Text>
      </TouchableOpacity>}

      {/* Appearance */}
      <Caps style={{marginTop:20,marginBottom:8}}>Appearance</Caps>
      <Block style={{padding:8,marginBottom:6}}>
        <View style={{flexDirection:'row',gap:8}}>
          {[{key:'light',label:'Light'},{key:'dark',label:'Dark'},{key:'system',label:'System'}].map(function(opt){
            var sel=themeMode===opt.key;
            return <TouchableOpacity key={'tm_'+opt.key} style={{
              flex:1,height:64,borderRadius:12,
              backgroundColor:sel?theme.primary:theme.surfaceElevated,
              alignItems:'center',justifyContent:'center',gap:6,
              borderWidth:sel?0:StyleSheet.hairlineWidth,borderColor:theme.border,
            }} onPress={function(){haptic('light');setThemeMode(opt.key);}}>
              <View style={{width:18,height:18,borderRadius:9999,backgroundColor:sel?'#fff':theme.text}}/>
              <Text style={{fontFamily:FF.sansBold,fontWeight:'700',fontSize:12,color:sel?'#fff':theme.textSecondary}}>{opt.label}</Text>
            </TouchableOpacity>;
          })}
        </View>
      </Block>
      <Caps color={theme.muted} style={{marginBottom:8}}>System follows your device's appearance setting.</Caps>

      {/* Account */}
      <Caps style={{marginTop:20,marginBottom:8}}>Account</Caps>
      {listRow('Your profile',null,function(){setShowProfile(true);})}
      {listRow('Revisit your answers',null,function(){haptic('light');openQuestionnaire&&openQuestionnaire();})}
      {listRow('Our promise',null,function(){haptic('light');setShowOurPromise(true);},{emoji:'🤝'})}

      {/* Behavior toggles */}
      <Caps style={{marginTop:20,marginBottom:8}}>How the app behaves</Caps>
      <Block style={{padding:14,marginBottom:6}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <View style={{flex:1,paddingRight:10}}>
            <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:14,color:theme.text}}>Evening reminders</Text>
            <Caps color={theme.muted} style={{marginTop:2}}>Smart reminder at 8 PM if today is incomplete</Caps>
          </View>
          <Switch value={notificationEnabled} onValueChange={async function(next){setNotificationEnabled&&setNotificationEnabled(next);try{await supabase.from('users').update({notification_enabled:next}).eq('id',userId);}catch(e){}}}/>
        </View>
      </Block>
      <Block style={{padding:14,marginBottom:6}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <View style={{flex:1,paddingRight:10}}>
            <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:14,color:theme.text}}>Show water tracking</Text>
            <Caps color={theme.muted} style={{marginTop:2}}>Adds water entry to Wellness. Off by default.</Caps>
          </View>
          <Switch value={waterTrackingEnabled} onValueChange={async function(next){setWaterTrackingEnabled&&setWaterTrackingEnabled(next);try{await supabase.from('users').update({water_tracking_enabled:next}).eq('id',userId);}catch(e){}}}/>
        </View>
      </Block>

      {/* Silent Hours — calm Home screen between configured times. Defaults 22:00–08:00.
          Three columns persist: silent_hours_enabled (bool), silent_hours_start, silent_hours_end (time).
          The HomeScreen reads these via useApp(). */}
      <Block style={{padding:14,marginBottom:6}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <View style={{flex:1,paddingRight:10}}>
            <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:14,color:theme.text}}>Silent hours</Text>
            <Caps color={theme.muted} style={{marginTop:2}}>{silentHoursEnabled?(silentHoursStart+' – '+silentHoursEnd):'Off'}</Caps>
          </View>
          <Switch value={silentHoursEnabled} onValueChange={async function(next){
            setSilentHoursEnabled&&setSilentHoursEnabled(next);
            try{await supabase.from('users').update({silent_hours_enabled:next}).eq('id',userId);}catch(e){}
          }}/>
        </View>
        {silentHoursEnabled?<View style={{marginTop:12,flexDirection:'row',gap:10}}>
          <TouchableOpacity onPress={function(){setSilentPicker('start');}} style={{flex:1,backgroundColor:theme.surfaceElevated,borderRadius:10,paddingVertical:10,paddingHorizontal:12,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border}}>
            <Caps color={theme.muted}>Start</Caps>
            <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:16,color:theme.text,marginTop:2}}>{silentHoursStart}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={function(){setSilentPicker('end');}} style={{flex:1,backgroundColor:theme.surfaceElevated,borderRadius:10,paddingVertical:10,paddingHorizontal:12,borderWidth:StyleSheet.hairlineWidth,borderColor:theme.border}}>
            <Caps color={theme.muted}>End</Caps>
            <Text style={{fontFamily:FF.sansSemi,fontWeight:'600',fontSize:16,color:theme.text,marginTop:2}}>{silentHoursEnd}</Text>
          </TouchableOpacity>
        </View>:null}
        <Text style={{fontFamily:FF.sans,fontSize:11,color:theme.muted,marginTop:10,lineHeight:16}}>We'll go quiet during these hours. No nudges, just a calm home screen. You can still log anything you want.</Text>
        {silentPicker&&Platform.OS!=='web'?(function(){
          var hm=(silentPicker==='start'?silentHoursStart:silentHoursEnd).split(':');
          var initial=new Date();initial.setHours(Number(hm[0])||0,Number(hm[1])||0,0,0);
          return <DateTimePicker
            value={initial}
            mode="time"
            is24Hour={true}
            display={Platform.OS==='ios'?'spinner':'default'}
            onChange={async function(event,d){
              setSilentPicker(null);
              if(event&&event.type==='dismissed')return;
              if(!d)return;
              var h=String(d.getHours()).padStart(2,'0');
              var m=String(d.getMinutes()).padStart(2,'0');
              var hhmm=h+':'+m;
              if(silentPicker==='start'){setSilentHoursStart&&setSilentHoursStart(hhmm);try{await supabase.from('users').update({silent_hours_start:hhmm}).eq('id',userId);}catch(e){}}
              else{setSilentHoursEnd&&setSilentHoursEnd(hhmm);try{await supabase.from('users').update({silent_hours_end:hhmm}).eq('id',userId);}catch(e){}}
            }}
          />;
        })():null}
      </Block>

      {/* Your data */}
      <Caps style={{marginTop:20,marginBottom:8}}>Your data</Caps>
      {listRow('Pull latest from cloud',null,async function(){
        try{
          await refreshActivityFeed&&refreshActivityFeed();
          Alert.alert('Refreshed','Synced latest family activity.');
        }catch(e){
          showFriendlyError('Could not refresh data',e);
        }
      })}

      {/* Under the hood */}
      <Caps style={{marginTop:20,marginBottom:8}}>Under the hood</Caps>
      {listRow('App version','v1.0.0',function(){var n=debugTaps+1;setDebugTaps(n);if(n>=7){setDebugEnabled(true);Alert.alert('Debug mode','Developer options unlocked for this session.');}})}
      {debugEnabled&&<Block bg={theme.surfaceElevated} style={{padding:14,marginBottom:6}}>
        <Caps>Debug enabled</Caps>
        <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.muted,marginTop:6}}>User: {userId}</Text>
        <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.muted}}>Family: {familyId}</Text>
        <Text style={{fontFamily:FF.sans,fontSize:12,color:theme.muted}}>Members: {members.length}</Text>
      </Block>}

      {/* Diagnostics (build #5) — exports invite-join flow logs via Share intent */}
      <Caps style={{marginTop:20,marginBottom:8}}>Diagnostics</Caps>
      {listRow('Send debug logs','Share invite-join trace',function(){haptic('light');shareDiagLogs();})}

      {/* Sign out */}
      <View style={{marginTop:20}}>
        {listRow('Sign out',null,async function(){
          haptic('light');
          try{
            if(userProfile&&userProfile.user_type==='member'){
              await supabase.from('family_members').delete().eq('family_id',familyId).eq('user_id',userId);
              await supabase.from('users').update({family_id:null}).eq('id',userId);
            }
          }catch(e){console.log('[MEMBER LOGOUT RESET ERROR]',e);}
          supabase.auth.signOut();
        },{danger:true})}
      </View>

      {showAddMember&&<ModalSheet visible={true} title="Add a member" onClose={function(){setShowAddMember(false);setNewMemberName('');setNewMemberRole('parent');}}>
        <Text style={{fontFamily:FF.sans,fontSize:14,color:theme.textSecondary,marginBottom:16,lineHeight:20}}>Enter their name and role. We'll generate an invite code you can share.</Text>
        <Inp label="Name" value={newMemberName} onChangeText={setNewMemberName} placeholder="First name is fine" maxLength={48}/>
        <Caps style={{marginTop:8,marginBottom:8}}>Role</Caps>
        <View style={[z.row,{gap:8,marginBottom:18,flexWrap:'wrap'}]}>
          {[{label:'Parent',value:'parent'},{label:'Child',value:'child'},{label:'Other',value:'other'}].map(function(opt){
            var sel=newMemberRole===opt.value;
            return <TouchableOpacity key={'add_role_'+opt.value} style={[z.chip,sel&&z.chipSel]} onPress={function(){haptic('light');setNewMemberRole(opt.value);}}>
              <Text style={[z.chipTx,sel&&z.chipSelTx]}>{opt.label}</Text>
            </TouchableOpacity>;
          })}
        </View>
        <View style={{flexDirection:'row',gap:10}}>
          <View style={{flex:1}}><SecondaryButton full disabled={addingMember} onPress={function(){setShowAddMember(false);setNewMemberName('');setNewMemberRole('parent');}}>Cancel</SecondaryButton></View>
          <View style={{flex:1.4}}><PrimaryButton full disabled={addingMember||!normalizeText(newMemberName)} onPress={async function(){
            var clean=normalizeText(newMemberName);
            if(!clean){haptic('error');Alert.alert('Missing name','Enter a name for this member.');return;}
            setAddingMember(true);
            try{
              var newCode=generateInviteCode();
              var ins=await supabase.from('family_invites').insert({
                family_id:familyId,
                invited_by:userId,
                invite_code:newCode,
                invited_member_name:clean,
                invited_member_role:newMemberRole,
                status:'pending',
              }).select().single();
              if(ins.error)throw ins.error;
              await refreshMembers();
              haptic('success');
              setShowAddMember(false);
              setNewMemberName('');
              setNewMemberRole('parent');
              setInviteSheet({id:'invite_'+ins.data.id,inviteId:ins.data.id,name:clean,role:newMemberRole,userId:null,inviteCode:newCode,_virtual:true});
            }catch(e){haptic('error');showFriendlyError('Could not add member',e);}
            setAddingMember(false);
          }}>{addingMember?'Adding…':'Add member'}</PrimaryButton></View>
        </View>
      </ModalSheet>}

      <View style={{height:32}}/>
    </ScrollView>
  </View>);
}

// ═══════════════════════════════════════════════════════════════
// MAIN TABS — wires the design TabBar atom to react-navigation.
// Order: Home | Finance | Family | Wellness | Reflect.
// ═══════════════════════════════════════════════════════════════
var TAB_ID_TO_ROUTE={home:'Home',finance:'Finance',family:'Family',wellness:'Wellness',reflect:'Reflect'};
var TAB_ROUTE_TO_ID={Home:'home',Finance:'finance',Family:'family',Wellness:'wellness',Reflect:'reflect'};

function TabBarAdapter(props){
  var state=props.state;
  var navigation=props.navigation;
  var activeRoute=state.routes[state.index]&&state.routes[state.index].name;
  var activeId=TAB_ROUTE_TO_ID[activeRoute]||'family';
  function handleChange(id){
    var routeName=TAB_ID_TO_ROUTE[id];
    if(!routeName)return;
    var idx=-1;
    for(var i=0;i<state.routes.length;i++){if(state.routes[i].name===routeName){idx=i;break;}}
    if(idx<0)return;
    var route=state.routes[idx];
    var event=navigation.emit({type:'tabPress',target:route.key,canPreventDefault:true});
    if(state.index!==idx&&!event.defaultPrevented){
      haptic('light');
      navigation.navigate(route.name);
    }
  }
  return <TabBar active={activeId} onChange={handleChange}/>;
}

var Tab=createBottomTabNavigator();
function MainTabs(){
  return(
    <Tab.Navigator
      initialRouteName="Family"
      screenOptions={{headerShown:false}}
      tabBar={function(props){return React.createElement(TabBarAdapter,props);}}
    >
      <Tab.Screen name="Home" component={HomeScreen}/>
      <Tab.Screen name="Finance" component={FinanceScreen}/>
      <Tab.Screen name="Family" component={FamilyScreen}/>
      <Tab.Screen name="Wellness" component={WellnessScreen}/>
      <Tab.Screen name="Reflect" component={ReflectScreen}/>
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
  // Phase B1: activities table (ACTIVITY_LOGGING_SPEC.md). Already migrated server-side with RLS + indexes.
  var[activities,setActivities]=useState([]);
  var[transactionComments,setTransactionComments]=useState([]);
  var[sharedGoals,setSharedGoals]=useState([]);
  var[sharedGoalContributions,setSharedGoalContributions]=useState([]);
  var[promises,setPromises]=useState([]);
  var[promiseCommitments,setPromiseCommitments]=useState([]);
  var[promiseSnapshots,setPromiseSnapshots]=useState([]);
  var[promiseReflections,setPromiseReflections]=useState([]);
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
  // Phase A1: current user's access_role from family_members (PERMISSIONS_SPEC.md two-tier model).
  // 'co_admin' | 'member' | null (null when not yet loaded). Combined with userProfile.user_type to compute tier.
  var[currentUserAccessRole,setCurrentUserAccessRole]=useState(null);
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
  var[recurringSubscriptions,setRecurringSubscriptions]=useState([]);
  var[notificationEnabled,setNotificationEnabled]=useState(true);
  var[waterTrackingEnabled,setWaterTrackingEnabled]=useState(false);
  // Silent Hours: HH:MM strings stored on users.silent_hours_{enabled,start,end}.
  // Default 22:00–08:00. Drives the calm Home screen between those times.
  var[silentHoursEnabled,setSilentHoursEnabled]=useState(true);
  var[silentHoursStart,setSilentHoursStart]=useState('22:00');
  var[silentHoursEnd,setSilentHoursEnd]=useState('08:00');
  // PHASE 6: water target — persisted on users.water_target_litres
  var[waterTargetLitres,setWaterTargetLitresState]=useState(2.5);
  // Wrap setter so calls also persist to DB
  function setWaterTargetLitres(next){
    setWaterTargetLitresState(next);
    if(user&&user.id){
      supabase.from('users').update({water_target_litres:next}).eq('id',user.id)
        .then(function(res){if(res&&res.error)console.log('[WATER TARGET PERSIST ERROR]',res.error);});
    }
  }
  // Screen target — persisted on users.screen_target_hours (column confirmed to exist in Supabase)
  var[screenTargetHrs,setScreenTargetHrsState]=useState(2);
  function setScreenTargetHrs(next){
    setScreenTargetHrsState(next);
    if(user&&user.id){
      supabase.from('users').update({screen_target_hours:next}).eq('id',user.id)
        .then(function(res){if(res&&res.error)console.log('[SCREEN TARGET PERSIST ERROR]',res.error);});
    }
  }
  // Android auto-intake (screen time from device UsageStatsManager) — JS scaffolding only.
  // Native module + Expo Prebuild migration + permission grant flow pending; column users.screen_time_auto_enabled
  // does not exist yet, so this fire-and-forget DB write may silently fail until the column is added.
  // When the native module lands, replace the stub `requestScreenTimePermission` with the real bridge call
  // and have a periodic background task upsert wellness rows with source='auto-android'.
  var[screenTimeAutoEnabled,setScreenTimeAutoEnabledState]=useState(false);
  function setScreenTimeAutoEnabled(next){
    setScreenTimeAutoEnabledState(next);
    if(user&&user.id){
      supabase.from('users').update({screen_time_auto_enabled:next}).eq('id',user.id)
        .then(function(){}).catch(function(){});
    }
  }
  function requestScreenTimePermission(){
    // STUB: replace with native module call to launch Settings → Usage Access for the app.
    // For now, just toggle the flag on. The native module will handle the OS permission grant.
    if(Platform.OS!=='android')return Promise.resolve(false);
    console.log('[SCREEN TIME AUTO] Permission grant flow stubbed — wire native module here');
    return Promise.resolve(true);
  }
  var navRef=useNavigationContainerRef();
  // STEP 5: set true when PASSWORD_RECOVERY fires so subsequent SIGNED_IN/USER_UPDATED events
  // skip the normal checkAuthState routing — the reset screen owns routing until the user
  // submits a new password (or cancels). Cleared by the reset screen's onComplete/onCancel.
  var recoveryPendingRef=useRef(false);

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

  async function refreshRecurringSubscriptions(){
    if(!userId)return[];
    var r=await supabase.from('recurring_subscriptions')
      .select('*')
      .eq('user_id',userId)
      .neq('user_status','dismissed')
      .order('confidence',{ascending:false});
    if(r.error){console.log('[RECURRING SUBS FETCH ERROR]',r.error);return[];}
    setRecurringSubscriptions(r.data||[]);
    return r.data||[];
  }

  async function dismissRecurringSubscription(id){
    var r=await supabase.from('recurring_subscriptions')
      .update({user_status:'dismissed',updated_at:new Date().toISOString()})
      .eq('id',id);
    if(r.error){haptic('error');showFriendlyError('Could not dismiss',r.error);return false;}
    haptic('light');
    await refreshRecurringSubscriptions();
    return true;
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

  // Promises Phase B evaluator. Runs once per active Promise per day
  // at app open. Reads existing tables (meals, wellness,
  // shared_goal_contributions) and writes promise_progress_snapshots
  // rows. If today >= end_date, also handles auto-transition to
  // complete or wound_down.
  //
  // Backfills any missing days from start_date to today, so a 7-day
  // gap (user didn't open the app for a week) produces a complete
  // history on next open.
  //
  // Per-type formulas match PROMISES_SPEC §6 with one deviation:
  // the spec says wellness.screen_time_minutes; the actual column
  // is wellness.screen_hrs (hours, not minutes). Used screen_hrs.
  // family_score_pct is stubbed (null progress) pending formula
  // clarification — see comment inline.
  async function evaluatePromiseProgress(fid){
    var family=fid||familyId;
    if(!family||!userId)return;

    try{
      var promRes=await supabase.from('promises')
        .select('*')
        .eq('family_id',family)
        .eq('status','active');
      if(promRes.error){console.log('[EVALUATOR] promises fetch error',promRes.error);return;}
      var activePromises=promRes.data||[];
      if(activePromises.length===0)return;

      var promiseIds=activePromises.map(function(p){return p.id;});
      var commRes=await supabase.from('promise_commitments')
        .select('*')
        .in('promise_id',promiseIds);
      if(commRes.error){console.log('[EVALUATOR] commitments fetch error',commRes.error);return;}
      var commitments=commRes.data||[];

      var commIds=commitments.map(function(c){return c.id;});
      var snapRes=commIds.length>0
        ?await supabase.from('promise_progress_snapshots')
            .select('commitment_id, snapshot_date')
            .in('commitment_id',commIds)
        :{data:[]};
      var existingSnaps={};
      (snapRes.data||[]).forEach(function(s){
        existingSnaps[s.commitment_id+'-'+s.snapshot_date]=true;
      });

      var todayISO=isoDate(new Date());
      var todayDate=new Date(todayISO+'T00:00:00Z');
      var rowsToInsert=[];

      for(var i=0;i<activePromises.length;i++){
        var p=activePromises[i];
        var pCommits=commitments.filter(function(c){return c.promise_id===p.id;});
        if(pCommits.length===0)continue;

        var startDate=new Date(p.start_date+'T00:00:00Z');
        var endDate=new Date(p.end_date+'T00:00:00Z');
        var walkUntil=todayDate<endDate?todayDate:endDate;

        var srcMeals=[],srcWellness=[],srcContribs=[];
        var memberIds=pCommits.map(function(c){return c.member_id;}).filter(Boolean);
        var userIds=pCommits.map(function(c){return c.user_id;}).filter(Boolean);

        if(memberIds.length>0){
          var mealRes=await supabase.from('meals')
            .select('member_id, date')
            .in('member_id',memberIds)
            .gte('date',p.start_date)
            .lte('date',isoDate(walkUntil));
          srcMeals=mealRes.data||[];

          var wellRes=await supabase.from('wellness')
            .select('member_id, date, screen_hrs')
            .in('member_id',memberIds)
            .gte('date',p.start_date)
            .lte('date',isoDate(walkUntil));
          srcWellness=wellRes.data||[];
        }
        if(userIds.length>0){
          var contribRes=await supabase.from('shared_goal_contributions')
            .select('user_id, amount, contributed_at')
            .in('user_id',userIds)
            .gte('contributed_at',p.start_date)
            .lte('contributed_at',isoDate(walkUntil)+'T23:59:59Z');
          srcContribs=contribRes.data||[];
        }

        var d=new Date(startDate);
        while(d<=walkUntil){
          var dateISO=isoDate(d);
          var elapsedDays=Math.floor((d-startDate)/86400000)+1;

          for(var j=0;j<pCommits.length;j++){
            var c=pCommits[j];
            // Skip pending and declined commitments. Only confirmed
            // ones count for evaluator and auto-transition.
            if(c.commitment_status!=='confirmed')continue;
            var key=c.id+'-'+dateISO;
            if(existingSnaps[key])continue;

            var progressValue=null;
            var progressTarget=null;
            var isOnTrack=null;
            var meta=null;

            if(c.commitment_type==='meal_log_days'){
              var memberMealDays={};
              srcMeals.forEach(function(m){
                if(m.member_id===c.member_id&&m.date<=dateISO){
                  memberMealDays[m.date]=true;
                }
              });
              progressValue=Object.keys(memberMealDays).length;
              progressTarget=elapsedDays;
              isOnTrack=progressTarget>0
                ?(progressValue/progressTarget>=0.8)
                :true;
            }
            else if(c.commitment_type==='screen_under_target'){
              var targetHrs=(c.commitment_target&&c.commitment_target.target_hours)||4;
              var underCount=0;
              srcWellness.forEach(function(w){
                if(w.member_id===c.member_id&&w.date<=dateISO
                   &&w.screen_hrs!==null&&Number(w.screen_hrs)<=targetHrs){
                  underCount++;
                }
              });
              progressValue=underCount;
              progressTarget=elapsedDays;
              isOnTrack=progressTarget>0
                ?(progressValue/progressTarget>=0.8)
                :true;
              meta={target_hours:targetHrs};
            }
            else if(c.commitment_type==='contribution_amount'){
              var sumAmt=0;
              srcContribs.forEach(function(cb){
                if(cb.user_id===c.user_id&&cb.contributed_at<=dateISO+'T23:59:59Z'){
                  sumAmt+=Number(cb.amount||0);
                }
              });
              progressValue=sumAmt;
              progressTarget=(c.commitment_target&&c.commitment_target.target_amount)||null;
              isOnTrack=progressTarget!==null&&progressTarget>0
                ?(progressValue>=progressTarget)
                :null;
            }
            else if(c.commitment_type==='family_score_pct'){
              // STUB: spec says "average % of weekly target hit" but
              // family_scores has no weekly_target column. Punted to
              // null until formula is clarified. See PROMISES_SPEC §6.
              progressValue=null;
              progressTarget=null;
              isOnTrack=null;
            }
            else {
              // commitment_type === 'custom' — relies on manually_marked_done.
              progressValue=c.manually_marked_done?1:0;
              progressTarget=1;
              isOnTrack=c.manually_marked_done;
            }

            rowsToInsert.push({
              commitment_id:c.id,
              snapshot_date:dateISO,
              progress_value:progressValue,
              progress_target:progressTarget,
              is_on_track:isOnTrack,
              meta:meta,
            });
          }

          d=new Date(d.getTime()+86400000);
        }
      }

      if(rowsToInsert.length>0){
        var insRes=await supabase.from('promise_progress_snapshots')
          .insert(rowsToInsert);
        if(insRes.error)console.log('[EVALUATOR] snapshot insert error',insRes.error);
      }

      for(var k=0;k<activePromises.length;k++){
        var ap=activePromises[k];
        var apEnd=new Date(ap.end_date+'T00:00:00Z');
        if(todayDate<apEnd)continue;

        var apCommits=commitments.filter(function(c){return c.promise_id===ap.id;});
        var allOnTrack=true;
        for(var m=0;m<apCommits.length;m++){
          var cm=apCommits[m];
          if(cm.commitment_status!=='confirmed')continue;
          if(cm.commitment_type==='custom'){
            if(!cm.manually_marked_done){allOnTrack=false;break;}
            continue;
          }
          var lastSnapRes=await supabase.from('promise_progress_snapshots')
            .select('is_on_track')
            .eq('commitment_id',cm.id)
            .order('snapshot_date',{ascending:false})
            .limit(1).maybeSingle();
          if(lastSnapRes.error){allOnTrack=false;break;}
          if(!lastSnapRes.data||lastSnapRes.data.is_on_track!==true){
            allOnTrack=false;break;
          }
        }

        var newStatus=allOnTrack?'complete':'wound_down';
        var transRes=await supabase.from('promises').update({
          status:newStatus,
          updated_at:new Date().toISOString(),
        }).eq('id',ap.id);

        if(!transRes.error&&logActivity){
          await logActivity('promise',{
            user_name:'Wellthy',
            action:newStatus==='complete'?'completed':'wound_down',
            title:ap.title,
          },ap.id);
        }
      }

      if(refreshPromises)await refreshPromises(family);
      if(refreshPromiseCommitments)await refreshPromiseCommitments(family);

    }catch(e){
      console.log('[EVALUATOR] unexpected error',e);
    }
  }

  // Register this device for push notifications
  async function registerPush(uid){
    if(!Device.isDevice){console.log('[PUSH] not a physical device, skipping');return;}
    try{
      if(Platform.OS==='android'){
        await Notifications.setNotificationChannelAsync('default',{
          name:'default',
          importance:Notifications.AndroidImportance.DEFAULT,
          vibrationPattern:[0,250,250,250],
          lightColor:'#FF231F7C',
        });
      }
      var{status:ex}=await Notifications.getPermissionsAsync();
      var finalStatus=ex;
      if(ex!=='granted'){
        var r=await Notifications.requestPermissionsAsync();
        finalStatus=r.status;
      }
      if(finalStatus!=='granted'){console.log('[PUSH] permission denied');return;}

      var projectId=Constants.expoConfig?.extra?.eas?.projectId
                   ||Constants.easConfig?.projectId;
      if(!projectId){console.log('[PUSH] no projectId resolved; cannot register on standalone build');return;}

      var td=await Notifications.getExpoPushTokenAsync({projectId:projectId});
      console.log('[PUSH] got token:',(td.data||'').slice(0,30)+'...');

      var up=await supabase.from('push_tokens').upsert({
        user_id:uid,
        token:td.data,
        platform:Platform.OS,
        updated_at:new Date().toISOString(),
      },{onConflict:'token'});
      if(up.error)console.log('[PUSH] upsert error:',up.error.message);
      else console.log('[PUSH] token upserted for user',uid);
    }catch(e){
      console.log('[PUSH] register error:',e?.message||e);
    }
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

      // Drain pending invite-join (deferred from joinAndLink) BEFORE the user lookup so
      // partial completions from a prior session self-heal: the writes are idempotent and
      // re-running them ensures users / family_members / family_invites stay consistent
      // even if a previous attempt died after only some writes succeeded.
      // Wrapped in its own try/catch so transient drain errors don't bounce user to auth.
      try{
        var pendingRaw=await AsyncStorage.getItem('pendingInviteJoin');
        if(pendingRaw){
          var parsed=JSON.parse(pendingRaw);
          // Diag (c) — drain entered. Logs both UIDs every time so a mismatch is captured
          // even when the existing 'auth uid mismatch' branch then skips the upsert.
          await diagLog('drain entered. authUid='+sessionUser.id+' parsedUid='+parsed.auth_user_id+' email='+sessionUser.email+' uidMatch='+(parsed.auth_user_id===sessionUser.id));
          var ageMs=Date.now()-new Date(parsed.created_at||0).getTime();
          if(ageMs>24*60*60*1000){
            console.log('[INVITE JOIN] stale pending state (>24h), clearing');
            await AsyncStorage.removeItem('pendingInviteJoin');
          }else if(parsed.auth_user_id!==sessionUser.id){
            console.log('[INVITE JOIN] auth uid mismatch (got '+sessionUser.id+', expected '+parsed.auth_user_id+'), clearing');
            await AsyncStorage.removeItem('pendingInviteJoin');
          }else{
            var inviteCheck=await supabase.from('family_invites').select('id,status,used_by').eq('id',parsed.invite_id).maybeSingle();
            if(inviteCheck.error)throw inviteCheck.error;
            var freshInv=inviteCheck.data;
            if(!freshInv){
              console.log('[INVITE JOIN] invite no longer exists; rolling back');
              await AsyncStorage.removeItem('pendingInviteJoin');
              await supabase.auth.signOut();
              Alert.alert('Invite no longer valid','This invite was cancelled. Ask family admin for a new code.');
              setLoading(false);
              return;
            }
            var alreadyAcceptedByUs=freshInv.status==='accepted'&&freshInv.used_by===sessionUser.id;
            var takenByOther=(freshInv.status==='accepted'&&freshInv.used_by&&freshInv.used_by!==sessionUser.id)||freshInv.status==='cancelled'||freshInv.status==='expired';
            if(takenByOther){
              console.log('[INVITE JOIN] invite no longer available; rolling back');
              await AsyncStorage.removeItem('pendingInviteJoin');
              await supabase.auth.signOut();
              Alert.alert('Invite no longer valid','This invite was used by another person. Ask family admin for a new code.');
              setLoading(false);
              return;
            }

            console.log('[INVITE JOIN] completing deferred writes for',sessionUser.email);

            // Fix Y (build #7) — step-by-step instrumentation. Each drain step now logs its
            // start and end with the SQL error if any. The previous single-try block swallowed
            // failures with no diagLog visibility, so we couldn't see WHY family_members.insert
            // was failing for tsp.chinnu (build #6 → questionnaire-loop bug).
            var drainStep='users.upsert';
            try{
              await diagLog('drain step 1/4 START: users.upsert (set user_type=member, family_id='+parsed.family_id+'; QC unchanged)');
              // Fix X (build #7) — REMOVED questionnaire_completed:false from this payload.
              // It was overwriting TRUE→FALSE on every drain retry whenever a later step
              // (family_members.insert, etc.) failed and pendingInviteJoin wasn't cleared.
              // Result was the user being asked to fill the questionnaire on every app reopen.
              // Default value (false) applies on first INSERT via column default; on retry the
              // existing value is preserved.
              var inviteUserUpsert=await supabase.from('users').upsert({
                [DB_COLUMNS.USERS.ID]:sessionUser.id,
                [DB_COLUMNS.USERS.AUTH_USER_ID]:sessionUser.id,
                [DB_COLUMNS.USERS.USER_TYPE]:'member',
                [DB_COLUMNS.USERS.EMAIL]:parsed.email||sessionUser.email,
                [DB_COLUMNS.USERS.NAME]:parsed.invited_member_name||((sessionUser.email||'').split('@')[0])||'Member',
                family_id:parsed.family_id,
                [DB_COLUMNS.USERS.QUESTIONNAIRE_DATA]:{invite_code:parsed.invite_code,invited_member_name:parsed.invited_member_name,invited_member_role:parsed.invited_member_role},
              }).select().single();
              if(inviteUserUpsert.error)throw inviteUserUpsert.error;
              await diagLog('drain step 1/4 OK: users.upsert');

              drainStep='family_members.select';
              await diagLog('drain step 2/4 START: family_members.select (existing-row check)');
              // family_members has no unique constraint on (family_id,user_id) — explicit
              // pre-check avoids duplicate rows on retry after partial completion.
              var existingMember=await supabase.from('family_members').select('id').eq('family_id',parsed.family_id).eq('user_id',sessionUser.id).maybeSingle();
              if(existingMember.error)throw existingMember.error;
              await diagLog('drain step 2/4 OK: family_members.select existed='+!!existingMember.data);

              if(!existingMember.data){
                drainStep='family_members.insert';
                await diagLog('drain step 3/4 START: family_members.insert role='+(parsed.invited_member_role||'parent').toLowerCase()+' access_role='+(parsed.invited_access_role||'member'));
                // Fix V (build #8) — see joinAndLink edit; column invited_by does not exist on family_members.
                var fmInsert=await supabase.from('family_members').insert({
                  family_id:parsed.family_id,
                  user_id:sessionUser.id,
                  role:(parsed.invited_member_role||'parent').toLowerCase(),
                  access_role:parsed.invited_access_role||'member',
                });
                if(fmInsert.error)throw fmInsert.error;
                await diagLog('drain step 3/4 OK: family_members.insert');
              }else{
                await diagLog('drain step 3/4 SKIPPED: family_members row exists');
              }

              if(!alreadyAcceptedByUs){
                drainStep='family_invites.update';
                await diagLog('drain step 4/4 START: family_invites.update code='+parsed.invite_code);
                var inviteUpd=await supabase.from('family_invites').update({status:'accepted',used_by:sessionUser.id}).eq('id',parsed.invite_id);
                if(inviteUpd.error)throw inviteUpd.error;
                await diagLog('drain step 4/4 OK: family_invites.update');
              }else{
                await diagLog('drain step 4/4 SKIPPED: invite already accepted by us');
              }

              await AsyncStorage.removeItem('pendingInviteJoin');
              await diagLog('drain COMPLETE: pendingInviteJoin cleared');
              console.log('[INVITE JOIN] deferred writes complete; user lookup will pick up the new row');
            }catch(stepErr){
              // Re-throw so the outer drain catch handles it, but FIRST log which step
              // failed and the SQL error message/code/details. This is the visibility
              // we were missing in build #6.
              await diagLog('drain step '+drainStep+' THREW. msg='+(stepErr&&stepErr.message)+' code='+(stepErr&&stepErr.code)+' details='+(stepErr&&stepErr.details)+' hint='+(stepErr&&stepErr.hint));
              throw stepErr;
            }
          }
        }
      }catch(drainErr){
        // Fix Y (build #7) — also log to AsyncStorage diag, not just console. The console-only
        // log in build #6 meant we had zero visibility on drain failures from the user's device.
        await diagLog('drain OUTER catch: '+(drainErr&&drainErr.message)+' code='+(drainErr&&drainErr.code));
        console.log('[INVITE JOIN DRAIN ERROR]',drainErr);
        // Fall through — user lookup will reflect whatever DB state we managed to write.
        // Drain errors don't block normal flow; AsyncStorage left intact for retry on next session.
      }

      // Resilient user lookup: retry up to 3× with backoff before giving up.
      // Cold-boot transient network/RLS hiccups were dropping users to the auth screen even with a valid session.
      var userLookup=null;
      for(var attempt=0;attempt<3;attempt++){
        try{
          userLookup=await supabase
            .from('users')
            .select('*, families!fk_users_family(*)')
            .or('auth_user_id.eq.'+sessionUser.id+',id.eq.'+sessionUser.id)
            .maybeSingle();
          if(!userLookup.error)break;
          console.log('[AUTH STATE] user lookup attempt '+(attempt+1)+' failed:',userLookup.error&&userLookup.error.message);
        }catch(lookupErr){
          console.log('[AUTH STATE] user lookup attempt '+(attempt+1)+' threw:',lookupErr&&lookupErr.message);
          userLookup={error:lookupErr};
        }
        if(attempt<2)await new Promise(function(r){setTimeout(r,400*(attempt+1));});
      }
      if(userLookup&&userLookup.error){
        // Session is valid but the user-record fetch keeps failing — most likely a transient network issue
        // on cold boot. Stay signed in with a minimal user object and let the realtime listeners + manual
        // refresh re-fetch when the connection recovers. Do NOT kick to auth (preserves the session).
        console.log('[AUTH STATE] Session present but user lookup failed after retries; staying signed in. Error:',userLookup.error&&userLookup.error.message);
        setCurrentUser({id:sessionUser.id,email:sessionUser.email});
        setCurrentScreen('main_app');
        setLoading(false);
        return;
      }
      var userDoc=userLookup&&userLookup.data;

      if(!userDoc){
        // Fix 3 (build #6) — belt-and-braces. The drain block at L7256 SHOULD have already
        // written this user's row if pendingInviteJoin was set + matched. If we're still here
        // with no userDoc, drain either didn't run or threw (caught silently above). Re-check
        // pendingInviteJoin and use its values — never silently hardcode 'primary' when the
        // user is actually an invited member.
        var rescueType='primary';
        var rescueFamilyId=null;
        var rescueName=normalizeText((sessionUser.email||'').split('@')[0])||'User';
        var rescueQData=null;
        try{
          var pendingRaw2=await AsyncStorage.getItem('pendingInviteJoin');
          if(pendingRaw2){
            var parsed2=JSON.parse(pendingRaw2);
            if(parsed2&&parsed2.auth_user_id===sessionUser.id){
              rescueType='member';
              rescueFamilyId=parsed2.family_id||null;
              rescueName=parsed2.invited_member_name||rescueName;
              // Fix Z (build #7) — also carry invited_access_role + invited_by so the
              // family_members.insert below uses the right access level (e.g. co_admin),
              // not a hardcoded 'member'.
              rescueQData={
                invite_code:parsed2.invite_code,
                invited_member_name:parsed2.invited_member_name||null,
                invited_member_role:parsed2.invited_member_role||null,
                invited_access_role:parsed2.invited_access_role||null,
                invited_by:parsed2.invited_by||null,
              };
              await diagLog('checkAuthState no-userDoc rescue from pendingInviteJoin → user_type=member family_id='+rescueFamilyId+' access_role='+(parsed2.invited_access_role||'member'));
            }else{
              await diagLog('checkAuthState no-userDoc — pendingInviteJoin present but uid mismatch. fallback to primary. parsedUid='+(parsed2&&parsed2.auth_user_id)+' authUid='+sessionUser.id);
            }
          }else{
            await diagLog('checkAuthState no-userDoc — no pendingInviteJoin. creating primary.');
          }
        }catch(e){
          await diagLog('checkAuthState no-userDoc — pendingInviteJoin read threw: '+(e&&e.message)+'. fallback to primary.');
        }
        console.log('[AUTH STATE] No public.users row found. Creating for auth user:',sessionUser.id,'as',rescueType);
        var createPayload={
          id:sessionUser.id,
          auth_user_id:sessionUser.id,
          user_type:rescueType,
          email:sessionUser.email,
          name:rescueName,
          [DB_COLUMNS.USERS.QUESTIONNAIRE_COMPLETED]:false,
        };
        if(rescueFamilyId)createPayload.family_id=rescueFamilyId;
        if(rescueQData)createPayload[DB_COLUMNS.USERS.QUESTIONNAIRE_DATA]=rescueQData;
        var createRes=await supabase
          .from('users')
          .insert(createPayload)
          .select()
          .single();
        if(createRes.error)throw createRes.error;
        userDoc=createRes.data;
        // If we rescued via invite, also write the family_members row + mark the invite accepted.
        // These would normally be done by the drain; do them here too in case drain failed.
        if(rescueType==='member' && rescueFamilyId){
          try{
            var existingFm=await supabase.from('family_members').select('id').eq('family_id',rescueFamilyId).eq('user_id',sessionUser.id).maybeSingle();
            if(!existingFm.data){
              // Fix V (build #8) — see joinAndLink edit; column invited_by does not exist on family_members.
              await supabase.from('family_members').insert({
                family_id:rescueFamilyId,
                user_id:sessionUser.id,
                role:((rescueQData&&rescueQData.invited_member_role)||'parent').toLowerCase(),
                access_role:(rescueQData&&rescueQData.invited_access_role)||'member',
              });
            }
            if(rescueQData&&rescueQData.invite_code){
              await supabase.from('family_invites').update({status:'accepted',used_by:sessionUser.id}).eq('invite_code',rescueQData.invite_code).eq('status','pending');
            }
            await AsyncStorage.removeItem('pendingInviteJoin');
            await diagLog('checkAuthState no-userDoc rescue completed family_members + invite + cleared AsyncStorage.');
          }catch(rescueErr){
            await diagLog('checkAuthState no-userDoc rescue family_members/invite write failed: '+(rescueErr&&rescueErr.message));
          }
        }
        setCurrentUser(userDoc);
        setCurrentScreen('questionnaire');
        console.log('[AUTH STATE] Route -> questionnaire (new user, type='+rescueType+')');
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
      // Defensive: if a session is still in storage, don't kick the user to auth on a transient
      // post-getSession failure. Prefer staying signed in over forcing re-login on every cold boot.
      try{
        var fallbackSess=await supabase.auth.getSession();
        if(fallbackSess&&fallbackSess.data&&fallbackSess.data.session){
          var fbUser=fallbackSess.data.session.user;
          console.log('[CHECK AUTH STATE] Recoverable error but session valid — staying signed in.');
          setUser(fbUser);
          setCurrentUser({id:fbUser.id,email:fbUser.email});
          setCurrentScreen('main_app');
          setLoading(false);
          return;
        }
      }catch(_){}
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
      // STEP 5: PASSWORD_RECOVERY fires when App.js's deep-link handler exchanges a recovery code.
      // Set the ref BEFORE setCurrentScreen so subsequent SIGNED_IN/USER_UPDATED short-circuit below.
      if(event==='PASSWORD_RECOVERY'){
        recoveryPendingRef.current=true;
        setCurrentScreen('reset_password');
        setLoading(false);
        return;
      }
      if(event==='SIGNED_OUT'){
        setFamilyId(null);setFamilyName('');setCurrentUserName('');setUserCreatedAt(null);setOnboarded(false);
        setMembers([]);setTransactions([]);setMeals([]);setGoals([]);setWellness([]);setActivities([]);
        setTransactionComments([]);setSharedGoals([]);setSharedGoalContributions([]);setPromises([]);setPromiseCommitments([]);setPromiseSnapshots([]);setPromiseReflections([]);setActivityFeed([]);setCustomCategories([]);setUserProfile(null);setMemberProfiles({});
        setScores([]);setStreaks([]);setIsAdmin(false);setShowSettings(false);setShowQuestionnaire(false);setQuickAction(null);
        setTodayNudge(null);setNudgeHistory([]);setDismissedNudgeIds([]);setRecurringTransactions([]);setRecurringSubscriptions([]);setNotificationEnabled(true);setWaterTrackingEnabled(false);setSilentHoursEnabled(true);setSilentHoursStart('22:00');setSilentHoursEnd('08:00');
        setCurrentUser(null);
      }
      if(event==='SIGNED_IN' && session && session.user && session.user.id){
        repairCreatorRoles(session.user.id).catch(function(err){console.log('[ROLE REPAIR SIGNIN ERROR]',err);});
      }
      // STEP 5: while recovery is pending, the reset screen owns routing — skip checkAuthState
      // for SIGNED_IN/INITIAL_SESSION/USER_UPDATED. SIGNED_OUT still goes through (cancels reset).
      if(recoveryPendingRef.current && (event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='USER_UPDATED')){
        return;
      }
      // Don't re-run checkAuthState on TOKEN_REFRESHED — it's a no-op for routing and causes
      // unnecessary user lookups. Only re-check on actual sign-in/sign-out / initial events.
      if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='INITIAL_SESSION'||event==='USER_UPDATED'){
        checkAuthState();
      }
    });

    // PHASE 6 FIX: keep refresh-token alive while app is in foreground.
    // Without this, the access token expires after ~1hr and the next launch fails getSession().
    // Per Supabase docs (https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native),
    // this must be registered once on the supabase.auth instance.
    var appStateListener=AppState.addEventListener('change',function(state){
      if(state==='active'){
        if(supabase.auth.startAutoRefresh)supabase.auth.startAutoRefresh();
      }else{
        if(supabase.auth.stopAutoRefresh)supabase.auth.stopAutoRefresh();
      }
    });
    // Kick off auto-refresh immediately if we're already foregrounded
    if(AppState.currentState==='active'&&supabase.auth.startAutoRefresh){
      supabase.auth.startAutoRefresh();
    }

    return function(){
      if(authListener&&authListener.data&&authListener.data.subscription)authListener.data.subscription.unsubscribe();
      if(appStateListener&&appStateListener.remove)appStateListener.remove();
    };
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
      setMembers([]);setTransactions([]);setMeals([]);setGoals([]);setWellness([]);setActivities([]);
      setTransactionComments([]);setSharedGoals([]);setSharedGoalContributions([]);setPromises([]);setPromiseCommitments([]);setPromiseSnapshots([]);setPromiseReflections([]);setActivityFeed([]);setCustomCategories([]);setUserProfile(null);setMemberProfiles({});
      setScores([]);setStreaks([]);setIsAdmin(false);setQuickAction(null);
      setNudgeHistory([]);setDismissedNudgeIds([]);setRecurringTransactions([]);setRecurringSubscriptions([]);setShowQuestionnaire(false);
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
          // Silent hours — DB stores time WITHOUT TZ (HH:MM:SS). Coerce to HH:MM for our pickers.
          if(typeof userDoc.silent_hours_enabled==='boolean')setSilentHoursEnabled(userDoc.silent_hours_enabled);
          if(userDoc.silent_hours_start)setSilentHoursStart(String(userDoc.silent_hours_start).slice(0,5));
          if(userDoc.silent_hours_end)setSilentHoursEnd(String(userDoc.silent_hours_end).slice(0,5));
          // PHASE 6: read water target from users row (defaults to 2.5L if null)
          var loadedTarget=Number(userDoc.water_target_litres);
          if(!isNaN(loadedTarget)&&loadedTarget>0)setWaterTargetLitresState(loadedTarget);
          // Screen target — read from users row (defaults to 2h if null)
          var loadedScreenTarget=Number(userDoc.screen_target_hours);
          if(!isNaN(loadedScreenTarget)&&loadedScreenTarget>0)setScreenTargetHrsState(loadedScreenTarget);
          // Screen-time auto-intake flag — column users.screen_time_auto_enabled may not exist yet; defaults false on miss
          if(typeof userDoc.screen_time_auto_enabled!=='undefined'&&userDoc.screen_time_auto_enabled!==null)setScreenTimeAutoEnabledState(!!userDoc.screen_time_auto_enabled);
          setUserProfile(userDoc);
          if(userDoc.family_id){
            await repairCreatorRoles(user.id,userDoc.family_id);
            var{data:famRow,error:famErr}=await supabase.from('families').select('created_by').eq('id',userDoc.family_id).maybeSingle();
            if(famErr)throw famErr;
            var adminByCreator=!!(famRow && famRow.created_by===user.id);
            var{data:memberRow}=await supabase.from('family_members').select('role,access_role').eq('family_id',userDoc.family_id).eq('user_id',user.id).maybeSingle();
            var adminByRole=memberRow&&(memberRow.role==='admin'||memberRow.access_role==='co_admin'||memberRow.access_role==='admin');
            setIsAdmin(!!(adminByCreator||adminByRole));
            setCurrentUserAccessRole((memberRow&&memberRow.access_role)||(memberRow&&memberRow.role==='admin'?'co_admin':'member'));
          } else {
            setIsAdmin(false);
            setCurrentUserAccessRole(null);
          }
        } else {
          setCurrentUserName(getDisplayName(null,user&&user.email));
          setUserCreatedAt(user.created_at||new Date().toISOString());
          setUserProfile(null);
          setOnboarded(false);setFamilyId(null);setIsAdmin(false);setCurrentUserAccessRole(null);
        }
      }catch(e){
        showFriendlyError('Could not load your profile',e);
        setCurrentUserName(getDisplayName(null,user&&user.email));
        setUserCreatedAt(user.created_at||new Date().toISOString());
        setUserProfile(null);
        setOnboarded(false);setFamilyId(null);setIsAdmin(false);setCurrentUserAccessRole(null);
      }
    })();
  },[user]);

  async function loadFamilyMembers(fid){
    var family=fid||familyId;
    if(!family){setMembers([]);return[];}
    var memRes=await supabase
      .from('family_members')
      .select(`
        *,
        users!family_members_user_id_fkey(id,name,email),
        families(family_name)
      `)
      .eq('family_id',family);
    if(memRes.error)throw memRes.error;

    var realRows=(memRes.data||[]).map(function(m,index){
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
        _virtual:false,
      };
    });

    var invRes=await supabase
      .from('family_invites')
      .select('id,invite_code,invited_member_name,invited_member_role,invited_access_role,status,used_by,created_at')
      .eq('family_id',family)
      .eq('status','pending');
    if(invRes.error){
      console.log('[LOAD INVITES ERROR]',invRes.error);
    }
    var pendingInvites=(invRes&&invRes.data||[]).filter(function(inv){
      if(!inv.used_by)return true;
      return !realRows.some(function(rm){return rm.userId===inv.used_by;});
    });

    var virtualRows=pendingInvites.map(function(inv,idx){
      return {
        id:'invite_'+inv.id,
        inviteId:inv.id,
        name:normalizeText(inv.invited_member_name)||'Member',
        role:inv.invited_member_role||'parent',
        accessRole:inv.invited_access_role==='co_admin'?'co_admin':'member',
        slot:realRows.length+idx,
        order:realRows.length+idx,
        userId:null,
        inviteCode:inv.invite_code||null,
        inviteExpiresAt:null,
        joinedAt:null,
        email:null,
        _virtual:true,
      };
    });

    var rows=realRows.concat(virtualRows);
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
  // Phase B1: activities load
  async function refreshActivities(fid){
    if(!(fid||familyId))return[];
    var family=(fid||familyId);
    var r=await supabase.from('activities').select('*').eq('family_id',family).order('date',{ascending:false}).order('created_at',{ascending:false});
    if(r.error){console.log('[ACTIVITIES FETCH ERROR]',r.error);return[];}
    var rows=(r.data||[]).map(function(a){return Object.assign({},a,{memberId:a.member_id,memberName:a.member_name});});
    setActivities(rows);
    return rows;
  }
  function upsertActivityLocal(row){
    if(!row||!row.id)return;
    var norm=Object.assign({},row,{memberId:row.member_id,memberName:row.member_name});
    setActivities(function(prev){return upsertById(prev,norm).sort(function(a,b){return String(b.date).localeCompare(String(a.date));});});
  }
  function removeActivityLocal(id){setActivities(function(prev){return(prev||[]).filter(function(a){return a.id!==id;});});}
  // Phase B6: scoring rule. recordScore('activity_logged', 10) capped at 30/day per member.
  // PER SPEC: do NOT call bumpStreak('activity'). Activity does not contribute to streak.
  async function addActivity(payload){
    try{
      var insRes=await supabase.from('activities').insert(payload).select().single();
      if(insRes.error)throw insRes.error;
      upsertActivityLocal(insRes.data);
      // Score with daily cap of 30 (3 entries × 10 pts). Count today's prior entries for this member.
      var todayISO=isoDate(new Date());
      var todayCount=(activities||[]).filter(function(a){return a.member_id===payload.member_id&&a.date===todayISO;}).length;
      if(todayCount<3){await recordScore(payload.family_id,payload.member_id,'activity_logged',10);}
      return insRes.data;
    }catch(e){console.log('[ADD ACTIVITY ERROR]',e);throw e;}
  }
  async function updateActivity(id,payload){
    try{
      var updRes=await supabase.from('activities').update(payload).eq('id',id).select().single();
      if(updRes.error)throw updRes.error;
      upsertActivityLocal(updRes.data);
      return updRes.data;
    }catch(e){console.log('[UPDATE ACTIVITY ERROR]',e);throw e;}
  }
  async function deleteActivity(id){
    try{
      var delRes=await supabase.from('activities').delete().eq('id',id);
      if(delRes.error)throw delRes.error;
      removeActivityLocal(id);
    }catch(e){console.log('[DELETE ACTIVITY ERROR]',e);throw e;}
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

  async function refreshPromises(fid){
    var family=fid||familyId;
    if(!family)return[];
    var r=await supabase.from('promises').select('*')
      .eq('family_id',family)
      .order('created_at',{ascending:false});
    if(r.error){console.log('[PROMISES FETCH ERROR]',r.error);return[];}
    setPromises(r.data||[]);
    return r.data||[];
  }

  async function refreshPromiseCommitments(fid){
    var family=fid||familyId;
    if(!family)return[];
    // RLS already scopes by family via parent promise.
    var r=await supabase.from('promise_commitments').select('*');
    if(r.error){console.log('[PROMISE COMMITMENTS FETCH ERROR]',r.error);return[];}
    setPromiseCommitments(r.data||[]);
    return r.data||[];
  }

  async function confirmPromiseCommitment(commitmentId){
    if(!commitmentId)return false;
    var r=await supabase.from('promise_commitments').update({
      commitment_status:'confirmed',
    }).eq('id',commitmentId).eq('user_id',userId);
    if(r.error){haptic('error');showFriendlyError('Could not confirm',r.error);return false;}
    haptic('success');
    if(refreshPromiseCommitments)await refreshPromiseCommitments();
    return true;
  }

  async function editAndConfirmPromiseCommitment(commitmentId,newText,newType,newTarget){
    if(!commitmentId)return false;
    var update={
      commitment_text:(newText||'').trim(),
      commitment_status:'confirmed',
    };
    if(newType)update.commitment_type=newType;
    if(newTarget!==undefined)update.commitment_target=newTarget;
    var r=await supabase.from('promise_commitments').update(update)
      .eq('id',commitmentId).eq('user_id',userId);
    if(r.error){haptic('error');showFriendlyError('Could not save',r.error);return false;}
    haptic('success');
    if(refreshPromiseCommitments)await refreshPromiseCommitments();
    return true;
  }

  async function declinePromiseCommitment(commitmentId){
    if(!commitmentId)return false;
    var r=await supabase.from('promise_commitments').update({
      commitment_status:'declined',
    }).eq('id',commitmentId).eq('user_id',userId);
    if(r.error){haptic('error');showFriendlyError('Could not decline',r.error);return false;}
    haptic('light');
    if(refreshPromiseCommitments)await refreshPromiseCommitments();
    return true;
  }

  async function refreshPromiseSnapshots(fid){
    var family=fid||familyId;
    if(!family)return[];
    // RLS scopes through parent commitment → parent promise → family.
    var r=await supabase.from('promise_progress_snapshots')
      .select('*')
      .order('snapshot_date',{ascending:false});
    if(r.error){console.log('[PROMISE SNAPSHOTS FETCH ERROR]',r.error);return[];}
    setPromiseSnapshots(r.data||[]);
    return r.data||[];
  }

  async function refreshPromiseReflections(fid){
    var family=fid||familyId;
    if(!family)return[];
    var r=await supabase.from('promise_reflections').select('*')
      .order('created_at',{ascending:false});
    if(r.error){console.log('[PROMISE REFLECTIONS FETCH ERROR]',r.error);return[];}
    setPromiseReflections(r.data||[]);
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
          refreshActivities(familyId),
          refreshRecurringTransactions(familyId),
          refreshTransactionComments(familyId),
          refreshSharedGoals(familyId),
          refreshSharedGoalContributions(familyId),
          refreshPromises(familyId),
          refreshPromiseCommitments(familyId),
          refreshPromiseSnapshots(familyId),
          refreshPromiseReflections(familyId),
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
    evaluatePromiseProgress(familyId).catch(function(e){console.log('[PROMISE EVALUATOR ERROR]',e);});
    var ch=supabase.channel('fam_'+familyId)
      .on('postgres_changes',{event:'*',schema:'public',table:'family_members',filter:'family_id=eq.'+familyId},function(){refreshMembers(familyId).catch(function(e){console.log('[REALTIME MEMBERS ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'family_invites',filter:'family_id=eq.'+familyId},function(){refreshMembers(familyId).catch(function(e){console.log('[REALTIME INVITES ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'transactions',filter:'family_id=eq.'+familyId},function(){refreshTransactions(familyId).catch(function(e){console.log('[REALTIME TX ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'meals',filter:'family_id=eq.'+familyId},function(){refreshMeals(familyId).catch(function(e){console.log('[REALTIME MEALS ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'goals',filter:'family_id=eq.'+familyId},function(){refreshGoals(familyId).catch(function(e){console.log('[REALTIME GOALS ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'wellness',filter:'family_id=eq.'+familyId},function(){refreshWellness(familyId).catch(function(e){console.log('[REALTIME WELLNESS ERROR]',e);});})
      .on('postgres_changes',{event:'*',schema:'public',table:'activities',filter:'family_id=eq.'+familyId},function(){refreshActivities(familyId).catch(function(e){console.log('[REALTIME ACTIVITIES ERROR]',e);});})
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

  if(currentScreen==='reset_password'){
    return<GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><NavigationContainer ref={navRef}><StatusBar barStyle={theme.statusBar} backgroundColor={theme.background}/>
      <ResetPasswordScreen
        onComplete={function(){
          recoveryPendingRef.current=false;
          checkAuthState();
        }}
        onCancel={async function(){
          recoveryPendingRef.current=false;
          try{await supabase.auth.signOut();}catch(e){console.log('[RESET CANCEL signOut]',e);}
        }}
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
                setCurrentScreen('statement_upload_onboarding');
              }}
            />
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if(currentScreen==='statement_upload_onboarding'){
    return (
      <GestureHandlerRootView style={{flex:1}}>
        <SafeAreaProvider>
          <NavigationContainer ref={navRef}>
            <StatusBar barStyle={theme.statusBar} backgroundColor={theme.background}/>
            <AppContext.Provider value={{familyId:familyId,userId:user.id,currentUserName:currentUserName}}>
              <StatementUploadOnboardingHost
                onDone={function(){setCurrentScreen('main_app');}}
              />
            </AppContext.Provider>
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // Phase 2.3 step 1: lifted from WellnessScreen so Home (2.1.B) and the
  // Protein Today hero (2.3.A) read the same array. Shape matches the
  // FamilyMemberRing atom's member prop: {member, current, target, targets}.
  var proteinTodayISO=isoDate(new Date());
  var proteinTodayMeals=(meals||[]).filter(function(m){return isoDate(m.date)===proteinTodayISO;});
  var proteinByMemberId={};
  proteinTodayMeals.forEach(function(m){
    var key=m.memberId||m.member_id||('name_'+(m.memberName||m.member_name||''));
    proteinByMemberId[key]=(proteinByMemberId[key]||0)+(Number(m.protein)||0);
  });
  var familyProteinToday=(members||[]).map(function(m){
    var profile=(memberProfiles&&m.userId)?memberProfiles[m.userId]:null;
    var targets=calculateProteinTargets(profile&&profile.weightKg?profile.weightKg:null);
    var proteinKey=m.id||('name_'+m.name);
    var consumed=proteinByMemberId[proteinKey]||proteinByMemberId['name_'+m.name]||0;
    return{member:m,target:targets.active,targets:targets,current:consumed};
  });

  return(<GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><AppContext.Provider value={{
    familyId:familyId,familyName:familyName,setFamilyName:setFamilyName,members:members,
    transactions:transactions,meals:meals,goals:goals,wellness:wellness,
    scores:scores,streaks:streaks,isAdmin:isAdmin,currentUserAccessRole:currentUserAccessRole,
    userId:user.id,currentUserName:currentUserName,userCreatedAt:userCreatedAt,
    todayNudge:todayNudge,
    nudgeHistory:nudgeHistory,
    recurringTransactions:recurringTransactions,
    recurringSubscriptions:recurringSubscriptions,
    promises:promises,
    promiseCommitments:promiseCommitments,
    promiseSnapshots:promiseSnapshots,
    promiseReflections:promiseReflections,
    transactionComments:transactionComments,
    sharedGoals:sharedGoals,
    sharedGoalContributions:sharedGoalContributions,
    activityFeed:activityFeed,
    customCategories:customCategories,
    userProfile:userProfile,
    memberProfiles:memberProfiles,
    familyProteinToday:familyProteinToday,
    notificationEnabled:notificationEnabled,
    setNotificationEnabled:setNotificationEnabled,
    waterTrackingEnabled:waterTrackingEnabled,
    setWaterTrackingEnabled:setWaterTrackingEnabled,
    silentHoursEnabled:silentHoursEnabled,
    setSilentHoursEnabled:setSilentHoursEnabled,
    silentHoursStart:silentHoursStart,
    setSilentHoursStart:setSilentHoursStart,
    silentHoursEnd:silentHoursEnd,
    setSilentHoursEnd:setSilentHoursEnd,
    waterTargetLitres:waterTargetLitres,
    setWaterTargetLitres:setWaterTargetLitres,
    screenTargetHrs:screenTargetHrs,
    setScreenTargetHrs:setScreenTargetHrs,
    screenTimeAutoEnabled:screenTimeAutoEnabled,
    setScreenTimeAutoEnabled:setScreenTimeAutoEnabled,
    requestScreenTimePermission:requestScreenTimePermission,
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
    refreshRecurringSubscriptions:refreshRecurringSubscriptions,
    dismissRecurringSubscription:dismissRecurringSubscription,
    refreshPromises:refreshPromises,
    refreshPromiseCommitments:refreshPromiseCommitments,
    refreshPromiseSnapshots:refreshPromiseSnapshots,
    refreshPromiseReflections:refreshPromiseReflections,
    confirmPromiseCommitment:confirmPromiseCommitment,
    editAndConfirmPromiseCommitment:editAndConfirmPromiseCommitment,
    declinePromiseCommitment:declinePromiseCommitment,
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
    activities:activities,refreshActivities:refreshActivities,addActivity:addActivity,updateActivity:updateActivity,deleteActivity:deleteActivity,
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
// to every screen, modal, and the TabBar.
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
  ReflectScreen,
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
  // ─────────────────────────────────────────────────────────────
  // FamilyOS Design Guide v2.0 — applied via tokens + font families
  // Colors here are LIGHT theme values; theme-aware screens override
  // via inline style={{...,color:theme.text}} so dark mode just works.
  // ─────────────────────────────────────────────────────────────

  // ── Layout ──────────────────────────────────────────────────
  scr:{flex:1,backgroundColor:'#FAF8F5'},
  fScr:{flex:1,backgroundColor:'#FAF8F5'},
  fl:{flex:1},
  pad:{paddingHorizontal:16,paddingBottom:120}, // guide: --sp-lg = 16px screen padding
  row:{flexDirection:'row',alignItems:'center'},
  cen:{alignItems:'center',justifyContent:'center'},

  // ── Auth ────────────────────────────────────────────────────
  authScr:{flex:1,backgroundColor:'#FAF8F5'},
  // Hero title is the one place we use DM Serif Display (per guide: marketing moments / page titles)
  authTitle:{fontFamily:FF.serif,fontSize:36,fontWeight:'400',color:'#1A1208',marginBottom:8,textAlign:'center',letterSpacing:-1,lineHeight:42},
  authSub:{fontFamily:FF.sans,fontSize:14,fontWeight:'400',color:'#6B5E52',marginBottom:32,textAlign:'center'},
  linkTx:{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:'#1C6B50'},

  // ── Questionnaire ───────────────────────────────────────────
  qScr:{flex:1,backgroundColor:'#FAF8F5'},
  qCenter:{flex:1,justifyContent:'center',alignItems:'center',paddingHorizontal:32},
  qPad:{paddingHorizontal:24,paddingTop:40,paddingBottom:60},
  qStickyProgWrap:{position:'absolute',top:0,left:0,right:0,zIndex:999,backgroundColor:'#FAF8F5',paddingHorizontal:24,paddingTop:14,paddingBottom:8,borderBottomWidth:0.5,borderBottomColor:'#EDE8E2'},
  qOpener:{fontFamily:FF.sansSemi,fontSize:10,fontWeight:'700',color:'#A89D95',textAlign:'center',marginBottom:40,letterSpacing:0.8,textTransform:'uppercase'},
  qText:{fontFamily:FF.sansMed,fontSize:17,fontWeight:'500',color:'#1A1208',lineHeight:26,marginBottom:24,letterSpacing:-0.3},
  qNote:{fontFamily:FF.sans,fontSize:12,fontWeight:'400',color:'#A89D95',marginBottom:16,lineHeight:18},
  qTransition:{fontFamily:FF.serifItalic,fontSize:22,fontWeight:'400',color:'#1A1208',textAlign:'center',lineHeight:32,fontStyle:'italic'},
  qFinalTitle:{fontFamily:FF.serif,fontSize:32,fontWeight:'400',color:'#1A1208',textAlign:'center',marginBottom:16,letterSpacing:-1},
  qFinalBody:{fontFamily:FF.sansItalic,fontSize:16,fontWeight:'400',color:'#6B5E52',textAlign:'center',lineHeight:24,fontStyle:'italic'},
  qInput:{fontFamily:FF.sans,height:48,borderWidth:0.5,borderColor:'#EDE8E2',borderRadius:12,paddingHorizontal:14,paddingVertical:10,fontSize:15,color:'#1A1208',backgroundColor:'#FFFFFF',marginBottom:8},
  qExample:{fontFamily:FF.sansItalic,fontSize:12,fontWeight:'400',color:'#A89D95',marginTop:4,lineHeight:18,fontStyle:'italic'},
  qKeepGoing:{fontFamily:FF.sansMed,fontSize:12,fontWeight:'500',color:'#C4773B',marginTop:4},
  qTransitionCard:{backgroundColor:'#FFFFFF',borderWidth:0.5,borderColor:'#EDE8E2',borderRadius:20,padding:24,marginBottom:16},
  qTransitionLine:{fontFamily:FF.serif,fontSize:22,fontWeight:'400',color:'#1A1208',textAlign:'center',lineHeight:32,letterSpacing:-0.5},
  qQuestionText:{fontFamily:FF.sansSemi,fontSize:15,fontWeight:'600',color:'#1A1208',lineHeight:22,marginBottom:8,marginTop:4,letterSpacing:-0.2},
  qProgDot:{flex:1,height:4,borderRadius:2,backgroundColor:'#EDE8E2'},
  qProgDotOn:{backgroundColor:'#1C6B50'},
  qSliderValue:{fontFamily:FF.sansBold,fontSize:32,fontWeight:'700',color:'#1A1208',marginBottom:8,textAlign:'center',letterSpacing:-1},
  qSliderChip:{minWidth:40,height:40,borderRadius:20,borderWidth:0.5,borderColor:'#EDE8E2',alignItems:'center',justifyContent:'center',paddingHorizontal:8,backgroundColor:'#FFFFFF'},
  qSliderChipSel:{backgroundColor:'#1C6B50',borderColor:'#1C6B50'},
  qSliderChipTx:{fontFamily:FF.sansMed,fontSize:13,color:'#6B5E52',fontWeight:'500'},
  qSliderChipTxSel:{fontFamily:FF.sansSemi,color:'#FFFFFF',fontWeight:'600'},
  qOption:{borderWidth:0.5,borderColor:'#EDE8E2',borderRadius:14,paddingVertical:14,paddingHorizontal:16,marginBottom:10,backgroundColor:'#FFFFFF'},
  qOptionSel:{backgroundColor:'#E4F2EC',borderColor:'#1C6B50'},
  qOptionTx:{fontFamily:FF.sansMed,fontSize:15,fontWeight:'500',color:'#1A1208'},
  qOptionSelTx:{fontFamily:FF.sansSemi,color:'#1C6B50',fontWeight:'600'},
  qBtn:{backgroundColor:'#1C6B50',borderRadius:12,paddingVertical:14,alignItems:'center',marginTop:24},
  qBtnDisabled:{backgroundColor:'#EDE8E2'},
  qSliderVal:{fontFamily:FF.sansBold,fontSize:36,fontWeight:'700',color:'#1A1208',textAlign:'center',marginBottom:16,letterSpacing:-1.2},
  qSliderRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:12},
  qSliderDot:{width:32,height:32,borderRadius:16,backgroundColor:'#F3EFE9',alignItems:'center',justifyContent:'center'},
  qSliderDotSel:{backgroundColor:'#1C6B50'},
  qSliderDotTx:{fontFamily:FF.sansSemi,fontSize:12,fontWeight:'600',color:'#6B5E52'},
  qSliderDotSelTx:{fontFamily:FF.sansSemi,color:'#FFFFFF'},

  // ── Typography (guide type scale, section 02) ─────────────
  // Hero number → 42px / 700 / -1.5px
  heroN:{fontFamily:FF.sansBold,fontSize:42,fontWeight:'700',letterSpacing:-1.5,marginBottom:4,color:'#1A1208',lineHeight:46},
  // H1 → 26px / 700 / -0.8px
  h1:{fontFamily:FF.sansBold,fontSize:26,fontWeight:'700',color:'#1A1208',marginBottom:4,letterSpacing:-0.8,lineHeight:32},
  // H2 → 20px / 700 / -0.5px (Sec component now uses this)
  sec:{fontFamily:FF.sansBold,fontSize:20,fontWeight:'700',color:'#1A1208',marginTop:24,marginBottom:12,letterSpacing:-0.5},
  // H3 → 17px / 600 / -0.3px
  sub:{fontFamily:FF.sansSemi,fontSize:17,fontWeight:'600',color:'#1A1208',letterSpacing:-0.3},
  // Body → 15px / 400
  body:{fontFamily:FF.sans,fontSize:15,fontWeight:'400',color:'#1A1208'},
  // Body Med → 14px / 500
  fv:{fontFamily:FF.sansMed,fontSize:14,fontWeight:'500',color:'#1A1208'},
  // Tx merchant — body med
  txM:{fontFamily:FF.sansSemi,fontSize:15,fontWeight:'600',color:'#1A1208'},
  // Caption → 11px / 400
  cap:{fontFamily:FF.sans,fontSize:11,fontWeight:'400',color:'#A89D95'},
  // Label (ALL CAPS) → 10px / 700 / 0.8px / muted
  caps:{fontFamily:FF.sansBold,fontSize:10,fontWeight:'700',color:'#A89D95',letterSpacing:0.8,textTransform:'uppercase'},

  // ── Cards & inputs ───────────────────────────────────────
  card:{backgroundColor:'#FFFFFF',borderRadius:20,borderWidth:0.5,borderColor:'#EDE8E2',padding:18,marginBottom:10}, // guide: card uses radius-xl, 0.5px border
  inp:{fontFamily:FF.sans,height:48,borderWidth:0.5,borderColor:'#EDE8E2',borderRadius:12,paddingHorizontal:14,paddingVertical:10,fontSize:15,color:'#1A1208',backgroundColor:'#FFFFFF'},
  dateBtn:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  dateBtnTx:{fontFamily:FF.sans,fontSize:15,color:'#1A1208'},
  placeholderTx:{color:'#A89D95'},
  pickRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:12,paddingHorizontal:14,borderRadius:12,borderWidth:0.5,borderColor:'#EDE8E2',marginBottom:8,backgroundColor:'#FFFFFF'},
  pickRowSel:{backgroundColor:'#E4F2EC',borderColor:'#1C6B50'},
  inpLabel:{fontFamily:FF.sansSemi,fontSize:12,fontWeight:'600',color:'#6B5E52',marginBottom:6,letterSpacing:0.2},

  // ── Chips ────────────────────────────────────────────────
  chip:{borderRadius:9999,borderWidth:0.5,borderColor:'#EDE8E2',paddingVertical:6,paddingHorizontal:14,backgroundColor:'#FFFFFF'},
  chipTx:{fontFamily:FF.sansSemi,fontSize:12,fontWeight:'600',color:'#6B5E52'},
  chipSel:{backgroundColor:'#E4F2EC',borderColor:'#1C6B50'},
  chipSelTx:{fontFamily:FF.sansSemi,color:'#1C6B50',fontWeight:'600'},

  // ── Plan / setup cards ───────────────────────────────────
  planCard:{backgroundColor:'#FFFFFF',borderRadius:20,borderWidth:0.5,borderColor:'#EDE8E2',padding:18,marginBottom:12},
  planSel:{borderColor:'#1C6B50',backgroundColor:'#E4F2EC'},
  planTitle:{fontFamily:FF.sansSemi,fontSize:17,fontWeight:'600',color:'#1A1208',marginBottom:4,letterSpacing:-0.3},
  planSub:{fontFamily:FF.sans,fontSize:14,fontWeight:'400',color:'#6B5E52',marginBottom:2},
  rmTx:{fontFamily:FF.sansSemi,fontSize:12,fontWeight:'600',color:'#C94040',marginTop:8},

  // ── Header ───────────────────────────────────────────────
  hdr:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingTop:8,paddingBottom:16},
  avS:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#FAF8F5'},
  avSTx:{fontFamily:FF.sansSemi,fontSize:11,fontWeight:'600'},
  famNm:{fontFamily:FF.sansBold,fontSize:20,fontWeight:'700',color:'#1A1208',letterSpacing:-0.5},
  hdrIco:{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:'#6B5E52'},

  // ── Dividers ─────────────────────────────────────────────
  vDiv:{width:0.5,backgroundColor:'rgba(255,255,255,0.18)',alignSelf:'stretch',marginHorizontal:14},
  hDiv:{height:0.5,backgroundColor:'#EDE8E2',marginVertical:10},

  // ── Stats strip ──────────────────────────────────────────
  strip:{flexDirection:'row',gap:8,marginBottom:4,marginTop:10},
  tile:{flex:1,backgroundColor:'#F3EFE9',borderRadius:16,paddingVertical:14,paddingHorizontal:12},
  tileLbl:{fontFamily:FF.sansSemi,fontSize:10,fontWeight:'700',color:'#6B5E52',marginBottom:6,letterSpacing:0.6,textTransform:'uppercase'},
  tileVal:{fontFamily:FF.sansBold,fontSize:18,fontWeight:'700',color:'#1A1208',letterSpacing:-0.4},

  // ── Buttons ──────────────────────────────────────────────
  // Legacy z.bPri / z.bSec / z.bGhost button styles deleted (audit fix #6, 2026-05-04).
  // All callsites converted to design-system <PrimaryButton> / <SecondaryButton> atoms.

  // ── Pills ────────────────────────────────────────────────
  pill:{borderRadius:9999,paddingVertical:6,paddingHorizontal:14,borderWidth:0.5,borderColor:'transparent'},
  pillTx:{fontFamily:FF.sansSemi,fontSize:12,fontWeight:'600'},

  // ── Status / OK / nudge cards ───────────────────────────
  ok:{backgroundColor:'#E4F2EC',borderRadius:12,paddingVertical:14,alignItems:'center'},
  okTx:{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:'#1C6B50'},
  nudge:{borderLeftWidth:3,borderLeftColor:'#C4773B',backgroundColor:'#FDF0E4',borderRadius:12,padding:14,marginTop:12},
  nudgeTx:{fontFamily:FF.sansMed,fontSize:14,fontWeight:'500',color:'#1A1208',lineHeight:21},
  insight:{borderLeftWidth:3,borderLeftColor:'#1C6B50',backgroundColor:'#E4F2EC',borderRadius:12,padding:14,marginTop:16},
  insightTx:{fontFamily:FF.sansMed,fontSize:14,fontWeight:'500',color:'#1C6B50',lineHeight:21},

  // ── Bars / charts ────────────────────────────────────────
  barRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',height:96,marginBottom:12},
  barC:{flex:1,alignItems:'center',justifyContent:'flex-end'},
  bar:{width:18,backgroundColor:'#1C6B50',borderRadius:6,marginBottom:6},
  barL:{fontFamily:FF.sansMed,fontSize:11,fontWeight:'500',color:'#A89D95'},
  note:{fontFamily:FF.sansMed,fontSize:12,fontWeight:'500',color:'#6B5E52',lineHeight:18},

  // ── Activity / list rows ────────────────────────────────
  actR:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:12,borderBottomWidth:0.5,borderBottomColor:'#EDE8E2'},
  actTx:{fontFamily:FF.sans,fontSize:14,fontWeight:'400',color:'#1A1208',flex:1},

  // ── Percent badge ────────────────────────────────────────
  pctB:{borderRadius:9999,paddingVertical:3,paddingHorizontal:9},
  pctT:{fontFamily:FF.sansBold,fontSize:11,fontWeight:'700'},

  // ── Tx row ───────────────────────────────────────────────
  txRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:12,borderBottomWidth:0.5,borderBottomColor:'#EDE8E2'},

  // ── Progress (guide: progress-track is 6px, surfaceEl bg, primary fill) ─
  pTrk:{height:6,backgroundColor:'#F3EFE9',borderRadius:3,overflow:'hidden'},
  pFl:{height:'100%',borderRadius:3,backgroundColor:'#1C6B50'},

  // ── Macros ───────────────────────────────────────────────
  macro:{fontFamily:FF.sansMed,fontSize:11,fontWeight:'500',color:'#6B5E52',backgroundColor:'#F3EFE9',borderRadius:8,paddingVertical:4,paddingHorizontal:10,marginRight:6},

  // ── Family score ─────────────────────────────────────────
  fScLbl:{fontFamily:FF.sansBold,fontSize:10,fontWeight:'700',color:'#C4773B',marginBottom:6,letterSpacing:0.8,textTransform:'uppercase'},
  fScNum:{fontFamily:FF.sansBold,fontSize:42,fontWeight:'700',color:'#1A1208',letterSpacing:-1.5,lineHeight:46},
  fScSub:{fontFamily:FF.sansMed,fontSize:12,fontWeight:'500',color:'#1C6B50',marginTop:4},

  // ── Family member cards ──────────────────────────────────
  chCard:{width:150,borderRadius:20,padding:16,alignItems:'center'},
  chAv:{width:48,height:48,borderRadius:24,backgroundColor:'rgba(255,255,255,0.25)',alignItems:'center',justifyContent:'center',marginBottom:8},
  chAvT:{fontFamily:FF.sansBold,fontSize:18,fontWeight:'700'},
  chNm:{fontFamily:FF.sansSemi,fontSize:14,fontWeight:'600',color:'#FFFFFF',letterSpacing:-0.2},
  chRole:{fontFamily:FF.sans,fontSize:11,fontWeight:'400',color:'rgba(255,255,255,0.75)',marginBottom:8},
  chPts:{fontFamily:FF.sansBold,fontSize:24,fontWeight:'700',color:'#FFFFFF',letterSpacing:-0.5},
  chStrk:{fontFamily:FF.sans,fontSize:11,fontWeight:'400',color:'rgba(255,255,255,0.75)',marginBottom:4},
  chPTrk:{height:5,backgroundColor:'rgba(255,255,255,0.2)',borderRadius:3,overflow:'hidden'},
  chPFl:{height:'100%',backgroundColor:'#FFFFFF',borderRadius:3},
  chDly:{fontFamily:FF.sans,fontSize:10,fontWeight:'400',color:'rgba(255,255,255,0.75)',textAlign:'right',marginTop:2},
  chInvite:{marginTop:10,backgroundColor:'rgba(255,255,255,0.25)',borderRadius:8,paddingVertical:7,paddingHorizontal:10,alignSelf:'stretch',alignItems:'center'},
  chInviteTx:{fontFamily:FF.sansSemi,fontSize:11,fontWeight:'600',color:'#FFFFFF',letterSpacing:0.3},

  // ── Modals ───────────────────────────────────────────────
  modalWrap:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.4)'},
  modal:{backgroundColor:'#FFFFFF',borderTopLeftRadius:28,borderTopRightRadius:28,padding:20,maxHeight:'85%'}, // guide: radius-xxl

  // ── Tab bar (legacy style — superseded by TabBar atom) ───────
  tBar:{height:64,backgroundColor:'#FFFFFF',borderTopWidth:0.5,borderTopColor:'#EDE8E2',paddingBottom:8,paddingTop:6,elevation:0,shadowOpacity:0},

  // ── Edit/action buttons ─────────────────────────────────
  editBtn:{width:32,height:32,alignItems:'center',justifyContent:'center',marginRight:6},
  editTx:{fontSize:16,color:'#A89D95'},

  // ── Stepper ──────────────────────────────────────────────
  stepBtn:{width:48,height:48,borderRadius:12,borderWidth:0.5,borderColor:'#EDE8E2',backgroundColor:'#F3EFE9',alignItems:'center',justifyContent:'center'},
  stepTx:{fontFamily:FF.sansBold,fontSize:22,fontWeight:'700',color:'#1C6B50'},

  // ── Checkbox ─────────────────────────────────────────────
  checkbox:{width:18,height:18,borderRadius:5,borderWidth:1.5,borderColor:'#C4773B',marginRight:10,backgroundColor:'#FFFFFF'},

  // ── Errors ───────────────────────────────────────────────
  inpErr:{borderColor:'#C94040',borderWidth:1.5},
  errTx:{fontFamily:FF.sansMed,fontSize:11,color:'#C94040',marginTop:2,marginBottom:4,fontWeight:'500'},

  // ── Filters ──────────────────────────────────────────────
  filterChip:{backgroundColor:'#FDF0E4',borderRadius:9999,paddingVertical:5,paddingHorizontal:10},
  filterChipTx:{fontFamily:FF.sansSemi,fontSize:11,color:'#C4773B',fontWeight:'600'},

  // ── Calendar ─────────────────────────────────────────────
  calCell:{width:'14.285%',aspectRatio:1,borderRadius:10,marginBottom:6,alignItems:'center',justifyContent:'center',borderWidth:0.5},
  calCellTx:{fontFamily:FF.sansMed,fontSize:13,color:'#1A1208',fontWeight:'500'},
  calDot:{width:5,height:5,borderRadius:3,marginTop:4},

  // ── Comments ─────────────────────────────────────────────
  commentBubble:{padding:12,borderRadius:14,marginBottom:8,borderWidth:0.5,borderColor:'#EDE8E2'},
  commentMine:{backgroundColor:'#E4F2EC',alignSelf:'flex-end',maxWidth:'90%'},
  commentOther:{backgroundColor:'#F3EFE9',alignSelf:'flex-start',maxWidth:'90%'},
  commentCountBadge:{position:'absolute',right:-2,top:-3,backgroundColor:'#1C6B50',borderRadius:9,paddingHorizontal:5,minWidth:18,alignItems:'center'},
  commentCountTx:{fontFamily:FF.sansBold,fontSize:10,color:'#FFFFFF',fontWeight:'700'},

  // ── Profile ──────────────────────────────────────────────
  profileAvatar:{width:72,height:72,borderRadius:36,backgroundColor:'#E4F2EC',alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:'#EDE8E2'},
  profileAvatarImg:{width:72,height:72,borderRadius:36},
  photoPreview:{width:96,height:96,borderRadius:12,marginBottom:10,borderWidth:0.5,borderColor:'#EDE8E2'},
  profileAvatarTx:{fontFamily:FF.sansBold,fontSize:26,fontWeight:'700',color:'#1C6B50',letterSpacing:-0.5},

  // ── Goal family badge ────────────────────────────────────
  goalFamilyBadge:{backgroundColor:'#E4F2EC',borderRadius:8,paddingVertical:3,paddingHorizontal:8,marginLeft:8},
  goalFamilyBadgeTx:{fontFamily:FF.sansSemi,fontSize:10,fontWeight:'600',color:'#1C6B50',letterSpacing:0.3},

  // ── Admin badge ──────────────────────────────────────────
  adminBadge:{backgroundColor:'rgba(255,255,255,0.22)',borderRadius:8,paddingVertical:2,paddingHorizontal:6,marginLeft:6},
  adminBadgeTx:{fontFamily:FF.sansBold,fontSize:10,fontWeight:'700',color:'#FFFFFF',letterSpacing:0.3},
});

