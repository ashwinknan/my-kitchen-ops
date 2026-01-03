import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Utensils, Calendar, ShoppingCart, Settings2, Flame, RefreshCcw, Check, Trash2, Plus, Minus, ChevronDown, ChevronUp, Database, WifiOff, AlertCircle, Terminal, Activity, ShieldAlert, X, Key, Info, ExternalLink, HelpCircle, ShieldCheck } from 'lucide-react';
import { Recipe, RecipeCategory, MealPlanDay, OptimizedSchedule } from './types';
import { fetchAllRecipes } from './services/recipeService';
import { optimizeCookingOps, suggestMealPlan } from './services/geminiService';
import { auth } from './firebase';

const App: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ops' | 'planner' | 'shopping'>('ops');
  const [loading, setLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // Ops State
  const [opsSelection, setOpsSelection] = useState<Recipe[]>([]);
  const [cookCount, setCookCount] = useState(1);
  const [stoveCount, setStoveCount] = useState(2);
  const [optimizedResult, setOptimizedResult] = useState<OptimizedSchedule | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);

  // Planner State
  const [plannerDays, setPlannerDays] = useState(3);
  const [mealPlan, setMealPlan] = useState<MealPlanDay[]>([]);
  const [fridgeVeggies, setFridgeVeggies] = useState('');
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);

  // Shopping List
  const [shoppingList, setShoppingList] = useState<{name: string, value: number, unit: string, checked: boolean}[]>([]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSystemLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 20));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      addLog("Initializing Kitchen Context...");
      const result = await fetchAllRecipes();
      setRecipes(result.data);
      addLog(`Success: Ready with ${result.data.length} recipes.`);
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return recipes.filter(r => 
      !opsSelection.find(s => s.id === r.id) && 
      (r.dishName.toLowerCase().includes(q) || r.category.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [recipes, searchQuery, opsSelection]);

  const addRecipe = (recipe: Recipe) => {
    setOpsSelection(prev => [...prev, recipe]);
    setSearchQuery('');
    setShowDropdown(false);
    setOptimizedResult(null);
    setOpsError(null);
    addLog(`Menu Add: ${recipe.dishName}`);
  };

  const removeRecipe = (id: string) => {
    const r = opsSelection.find(i => i.id === id);
    setOpsSelection(prev => prev.filter(r => r.id !== id));
    setOptimizedResult(null);
    if (r) addLog(`Menu Remove: ${r.dishName}`);
  };

  /**
   * Refined API key detection logic.
   */
  const ensureApiKey = async (): Promise<boolean> => {
    const envKey = (window as any).process?.env?.API_KEY || process.env.API_KEY;
    
    if (envKey && envKey !== "undefined" && envKey !== "" && envKey.length > 10) {
      addLog("Key Found: Using System Key.");
      return true;
    }

    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      addLog("Environment: AI Studio Detected. Checking for linked key...");
      const hasKey = await aiStudio.hasSelectedApiKey();
      
      if (!hasKey) {
        addLog("Action: Opening Key Selector...");
        if (aiStudio.openSelectKey) {
          await aiStudio.openSelectKey();
          addLog("Status: Dialog opened. Please select your project.");
          return true; // Per race-condition rules, proceed as if key is coming
        }
      } else {
        addLog("Key Found: Linked User Key.");
        return true;
      }
    }

    addLog("Error: No key detected in environment.");
    return false;
  };

  const checkAndRunOptimizer = async () => {
    if (opsSelection.length === 0) return;
    setOpsError(null);
    
    const keyReady = await ensureApiKey();
    if (!keyReady) {
      setOpsError("Connection Failed. Open the System Console (top right) and click 'Link Paid API Key'.");
      setShowDebug(true);
      return;
    }

    setOpsLoading(true);
    addLog("Optimizing batches...");

    try {
      const result = await optimizeCookingOps(opsSelection, cookCount, stoveCount);
      setOptimizedResult(result);
      addLog("Success: Plan received.");
      
      setTimeout(() => {
        document.getElementById('ops-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (e: any) {
      addLog(`Plan Error: ${e.message}`);
      setOpsError(e.message || "Failed to calculate the plan.");
    } finally {
      setOpsLoading(false);
    }
  };

  const generatePlan = async () => {
    setPlannerError(null);
    
    const keyReady = await ensureApiKey();
    if (!keyReady) {
      setPlannerError("Key Required. Open the System Console to Link.");
      setShowDebug(true);
      return;
    }

    setPlannerLoading(true);
    addLog("Consulting AI Chef...");
    
    try {
      const suggestedNames = await suggestMealPlan(recipes, fridgeVeggies, plannerDays);
      const newPlan: MealPlanDay[] = [];
      let nameIdx = 0;
      
      for (let i = 0; i < plannerDays; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        newPlan.push({
          date: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
          breakfast: recipes.find(r => r.dishName === suggestedNames[nameIdx++]),
          lunchDinner: recipes.find(r => r.dishName === suggestedNames[nameIdx++]),
          snack: recipes.find(r => r.dishName === suggestedNames[nameIdx++]),
        });
      }
      setMealPlan(newPlan);
      addLog(`Success: Menu generated.`);
    } catch (e: any) {
      addLog(`Planner Error: ${e.message}`);
      setPlannerError(e.message || "Could not generate suggestions.");
    } finally {
      setPlannerLoading(false);
    }
  };

  const generateShoppingList = () => {
    addLog("Aggregating ingredients...");
    const aggregation: Record<string, { name: string, value: number, unit: string }> = {};
    mealPlan.forEach(day => {
      const meals = [day.breakfast, day.lunchDinner, day.snack];
      meals.forEach(r => {
        if (!r) return;
        r.ingredients.forEach(ing => {
          const unit = ing.shopping?.unit || 'pcs';
          const value = ing.shopping?.value || 0;
          const key = `${ing.name.toLowerCase()}-${unit}`;
          if (!aggregation[key]) aggregation[key] = { name: ing.name, value: 0, unit: unit };
          aggregation[key].value += value;
        });
      });
    });
    setShoppingList(Object.values(aggregation).map(item => ({ ...item, checked: false })));
    setActiveTab('shopping');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Utensils className="animate-bounce text-orange-500" size={48} />
          <p className="text-slate-400 font-bold animate-pulse tracking-widest text-[10px] uppercase">Booting Kitchen OS</p>
        </div>
      </div>
    );
  }

  const hasApiKey = !!((window as any).process?.env?.API_KEY || process.env.API_KEY);

  return (
    <div className="max-w-xl mx-auto pb-32 px-4 pt-4 min-h-screen">
      {/* HEADER */}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Flame className="text-white" size={20} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">KitchenPlanner</h1>
        </div>
        <button 
          onClick={() => setShowDebug(!showDebug)} 
          className={`p-2 rounded-lg transition-all relative ${showDebug ? 'bg-slate-900 text-green-400 scale-110 shadow-lg shadow-slate-900/20' : 'text-slate-400'}`}
        >
          <Terminal size={18} />
          {(opsError || plannerError) && !showDebug && (
             <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
          )}
        </button>
      </header>

      {/* SYSTEM CONSOLE */}
      {showDebug && (
        <div className="mb-6 p-5 bg-slate-900 text-green-400 font-mono text-[11px] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200">
           <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-3">
            <span className="flex items-center gap-2 uppercase tracking-widest font-black text-white/50"><Terminal size={14}/> Console</span>
            <button 
              onClick={() => (window as any).aistudio?.openSelectKey?.()} 
              className="bg-orange-500 text-white px-4 py-1.5 rounded-xl flex items-center gap-2 hover:bg-orange-400 text-[10px] font-black active:scale-95 transition-all shadow-lg shadow-orange-500/20"
            >
              <Key size={14} /> Link Paid API Key
            </button>
           </div>
           
           <div className="grid grid-cols-2 gap-4 mb-6">
             <div className="space-y-1">
               <p className="text-slate-500 uppercase text-[9px] font-bold">Key Status</p>
               <p className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></div>
                 {hasApiKey ? 'READY' : 'REQUIRED'}
               </p>
             </div>
             <div className="space-y-1">
               <p className="text-slate-500 uppercase text-[9px] font-bold">Studio Interface</p>
               <p className="flex items-center gap-2 text-white">{(window as any).aistudio ? 'ENABLED' : 'NOT DETECTED'}</p>
             </div>
           </div>

           <div className="bg-white/5 p-4 rounded-2xl mb-6 space-y-3">
             <p className="text-orange-400 flex items-center gap-2 font-bold uppercase text-[9px] tracking-widest">
               <HelpCircle size={12}/> Linking Instructions:
             </p>
             <div className="space-y-2 text-[10px] text-slate-300 leading-relaxed">
               <p><span className="text-white font-bold">1. Log In:</span> Ensure you're logged into the Google account that has your API key in this browser.</p>
               <p><span className="text-white font-bold">2. Click Link:</span> Use the orange button above. It triggers a system pop-up.</p>
               <p><span className="text-white font-bold">3. Select Project:</span> Pick the project you created at <a href="https://aistudio.google.com" target="_blank" className="underline text-orange-400">AI Studio</a>.</p>
             </div>
           </div>

           <div className="bg-black/40 p-3 rounded-2xl max-h-40 overflow-y-auto border border-white/5">
             <p className="text-slate-600 mb-2 font-bold text-[8px] uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 pb-1">
               <Activity size={10}/> Event Log:
             </p>
             <div className="space-y-1">
               {systemLogs.map((log, i) => <p key={i} className="leading-relaxed font-medium break-words opacity-80">{log}</p>)}
               {systemLogs.length === 0 && <p className="text-slate-800 italic">Listening for events...</p>}
             </div>
           </div>
        </div>
      )}

      {/* TABS (OPS, PLANNER, SHOPPING) - Logic remains identical to previous version, just ensuring UI is consistent */}
      {activeTab === 'ops' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Kitchen Logistics</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 p-4 rounded-3xl space-y-3">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Cooking Staff</span>
                <div className="flex items-center justify-between">
                  <button onClick={() => setCookCount(Math.max(1, cookCount - 1))} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center bg-white text-slate-600 active:scale-90 transition-transform"><Minus size={16} /></button>
                  <span className="text-xl font-black text-slate-800">{cookCount}</span>
                  <button onClick={() => setCookCount(Math.min(4, cookCount + 1))} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center bg-white text-slate-600 active:scale-90 transition-transform"><Plus size={16} /></button>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-3xl space-y-3">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Burner Count</span>
                <div className="flex items-center justify-between">
                  <button onClick={() => setStoveCount(Math.max(1, stoveCount - 1))} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center bg-white text-slate-600 active:scale-90 transition-transform"><Minus size={16} /></button>
                  <span className="text-xl font-black text-slate-800">{stoveCount}</span>
                  <button onClick={() => setStoveCount(Math.min(6, stoveCount + 1))} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center bg-white text-slate-600 active:scale-90 transition-transform"><Plus size={16} /></button>
                </div>
              </div>
            </div>

            <div className="relative px-1" ref={searchRef}>
              <span className="text-xs text-slate-400 font-bold uppercase mb-2 block tracking-tight">Add Recipes</span>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  placeholder="Find a recipe..." 
                  className="w-full pl-11 pr-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-orange-500 transition-all font-semibold text-lg"
                  value={searchQuery}
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => {setSearchQuery(e.target.value); setShowDropdown(true);}}
                />
              </div>

              {showDropdown && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-100 rounded-[2rem] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  {filteredSuggestions.map(r => (
                    <button 
                      key={r.id} 
                      onClick={() => addRecipe(r)}
                      className="w-full px-6 py-5 text-left hover:bg-slate-50 flex justify-between items-center border-b border-slate-50 last:border-0"
                    >
                      <span className="font-bold text-slate-700">{r.dishName}</span>
                      <span className="text-[10px] bg-orange-50 text-orange-600 px-3 py-1 rounded-lg font-black uppercase tracking-tighter">{r.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {opsSelection.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6 px-1">
                {opsSelection.map(r => (
                  <div key={r.id} className="flex items-center gap-2 bg-slate-900 text-white pl-4 pr-1.5 py-1.5 rounded-full text-[11px] font-black shadow-lg">
                    {r.dishName.toUpperCase()}
                    <button onClick={() => removeRecipe(r.id)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {opsError && (
              <div className="mt-6 p-5 bg-red-50 border border-red-100 rounded-3xl flex gap-4 items-start animate-in shake-in">
                <ShieldAlert size={20} className="text-red-500 shrink-0 mt-1" />
                <div className="space-y-1">
                  <p className="text-sm text-red-800 font-black uppercase tracking-tight">System Message</p>
                  <p className="text-xs text-red-600 font-semibold leading-relaxed">{opsError}</p>
                </div>
              </div>
            )}

            <button 
              onClick={checkAndRunOptimizer}
              disabled={opsSelection.length === 0 || opsLoading}
              className="w-full mt-8 py-5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-100 disabled:text-slate-300 text-white font-black rounded-3xl transition-all shadow-xl shadow-orange-500/30 flex items-center justify-center gap-3 text-lg active:scale-95"
            >
              {opsLoading ? <RefreshCcw className="animate-spin" size={24} /> : <Flame size={24} />}
              {opsLoading ? 'Compiling Timeline...' : 'Plan My Cooking'}
            </button>
          </div>

          {optimizedResult && (
            <div id="ops-results" className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex justify-between items-center px-4">
                <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Timeline</h3>
                <span className="text-[10px] bg-slate-900 text-white px-4 py-2 rounded-2xl font-black uppercase tracking-widest">{optimizedResult.totalDuration} Min</span>
              </div>
              <div className="space-y-4">
                {optimizedResult.timeline.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-3xl flex items-center justify-center font-black text-xs shrink-0 border-4 transition-all ${step.isParallel ? 'bg-orange-500 text-white border-orange-400' : 'bg-white text-slate-300 border-slate-100'}`}>
                        {step.timeOffset}'
                      </div>
                      {i !== optimizedResult.timeline.length - 1 && <div className="w-1 h-full bg-slate-100 rounded-full my-2"></div>}
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex-1 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Assignee: Cook {step.assignees.join(' & ')}</span>
                         {step.isParallel && <span className="text-[8px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100 uppercase tracking-tighter">Parallel</span>}
                      </div>
                      <p className="text-sm font-bold text-slate-800 leading-relaxed">{step.action}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {step.involvedRecipes.map((r, ri) => (
                          <span key={ri} className="text-[9px] text-slate-400 font-black uppercase tracking-widest border border-slate-50 px-2 py-1 rounded-lg">{r}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PLANNER TAB */}
      {activeTab === 'planner' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8">
            <h2 className="text-lg font-black text-slate-900 tracking-tight px-2">Meal Architect</h2>
            <div className="space-y-4 px-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Plan Horizon</span>
                <span className="text-orange-500 font-black text-2xl tracking-tighter">{plannerDays} Days</span>
              </div>
              <input 
                type="range" min="1" max="7" 
                value={plannerDays}
                onChange={(e) => setPlannerDays(parseInt(e.target.value))}
                className="w-full h-2.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-orange-500 shadow-inner"
              />
            </div>
            <div className="space-y-3 px-2">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Fridge / Stock Info</span>
              <textarea 
                placeholder="What do you already have?" 
                className="w-full p-6 bg-slate-50 border-none rounded-3xl h-32 focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-semibold resize-none shadow-inner"
                value={fridgeVeggies}
                onChange={(e) => setFridgeVeggies(e.target.value)}
              />
            </div>
            {plannerError && (
              <div className="p-5 bg-red-50 border border-red-100 rounded-3xl flex gap-4 items-start animate-in shake-in">
                 <ShieldAlert size={20} className="text-red-500 shrink-0 mt-1" />
                 <div className="space-y-1">
                  <p className="text-sm text-red-800 font-black uppercase tracking-tight">System Message</p>
                  <p className="text-xs text-red-600 font-semibold leading-relaxed">{plannerError}</p>
                </div>
              </div>
            )}
            <button 
              onClick={generatePlan}
              disabled={plannerLoading || recipes.length === 0}
              className="w-full py-5 bg-slate-900 text-white font-black rounded-3xl flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all text-lg"
            >
              {plannerLoading ? <RefreshCcw className="animate-spin" size={24} /> : <Calendar size={24} />}
              {plannerLoading ? 'Designing Menu...' : 'Suggest a Menu'}
            </button>
          </div>
          {mealPlan.length > 0 && (
            <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
              {mealPlan.map((day, idx) => (
                <div key={idx} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm group hover:shadow-xl transition-all">
                  <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Day {idx + 1}</span>
                    <span className="text-[11px] font-black text-orange-400 uppercase tracking-tighter">{day.date}</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {(['breakfast', 'lunchDinner', 'snack'] as const).map((m) => (
                      <div key={m} className="p-6 flex justify-between items-center hover:bg-slate-50 transition-colors">
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-400 font-black uppercase block tracking-widest">{m === 'lunchDinner' ? 'Main' : m}</span>
                          <p className="font-black text-slate-800 text-xl tracking-tight">{day[m]?.dishName || 'Custom Selection'}</p>
                        </div>
                        <Utensils size={20} className="text-slate-200" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={generateShoppingList} className="w-full py-7 bg-orange-500 text-white font-black rounded-[2.5rem] shadow-2xl mt-8 flex items-center justify-center gap-3 active:scale-95">
                <ShoppingCart size={24} /> Generate Grocery Report
              </button>
            </div>
          )}
        </div>
      )}

      {/* SHOPPING TAB */}
      {activeTab === 'shopping' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Inventory</h2>
              <button onClick={() => setShoppingList(prev => prev.filter(i => !i.checked))} className="w-10 h-10 rounded-2xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center active:scale-90"><Trash2 size={20}/></button>
            </div>
            <div className="space-y-3">
              {shoppingList.map((item, i) => (
                <div key={i} onClick={() => {
                  const newList = [...shoppingList];
                  newList[i].checked = !newList[i].checked;
                  setShoppingList(newList);
                }} className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl cursor-pointer hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200 shadow-sm">
                  <div className="flex items-center gap-5">
                    <div className={`w-8 h-8 rounded-2xl border-2 flex items-center justify-center transition-all ${item.checked ? 'bg-green-500 border-green-500 shadow-lg' : 'bg-white border-slate-200'}`}>
                      {item.checked && <Check size={20} className="text-white" strokeWidth={5} />}
                    </div>
                    <span className={`text-lg font-bold tracking-tight ${item.checked ? 'text-slate-300 line-through' : 'text-slate-800'}`}>{item.name}</span>
                  </div>
                  <span className="text-[11px] font-black bg-white px-4 py-2 rounded-2xl border border-slate-100 text-slate-500">{item.value} {item.unit}</span>
                </div>
              ))}
              {shoppingList.length === 0 && (
                <div className="text-center py-24 text-slate-300 text-sm font-medium flex flex-col items-center gap-6 animate-in fade-in zoom-in-95">
                  <ShoppingCart size={48} className="opacity-10" />
                  <p className="uppercase tracking-[0.4em] text-[10px] font-black">All Supplies Accounted For</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STICKY NAV */}
      <nav className="fixed bottom-6 left-6 right-6 bg-slate-900/95 backdrop-blur-2xl py-6 px-12 flex justify-between items-center z-50 shadow-2xl rounded-[3rem] border border-white/10">
        {[
          { id: 'ops', icon: Flame, label: 'Cook' },
          { id: 'planner', icon: Calendar, label: 'Plan' },
          { id: 'shopping', icon: ShoppingCart, label: 'Buy' }
        ].map(btn => (
          <button 
            key={btn.id}
            onClick={() => setActiveTab(btn.id as any)} 
            className={`flex flex-col items-center gap-2 transition-all duration-500 group ${activeTab === btn.id ? 'text-orange-500 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <btn.icon size={28} strokeWidth={activeTab === btn.id ? 3 : 2} className="transition-all" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] group-hover:opacity-100 opacity-60 transition-opacity">{btn.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;