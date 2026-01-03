import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Utensils, Calendar, ShoppingCart, Settings2, Flame, RefreshCcw, Check, Trash2, Plus, Minus, ChevronDown, ChevronUp, Database, WifiOff, AlertCircle, Terminal, Activity, ShieldAlert, X, Key, Info } from 'lucide-react';
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
    setSystemLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 10));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      addLog("Fetching recipes from database...");
      const result = await fetchAllRecipes();
      setRecipes(result.data);
      addLog(`Success: Loaded ${result.data.length} recipes.`);
    } catch (e: any) {
      addLog(`Error: Database fetch failed - ${e.message}`);
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
    return recipes.filter(r => 
      !opsSelection.find(s => s.id === r.id) && 
      r.dishName.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);
  }, [recipes, searchQuery, opsSelection]);

  const addRecipe = (recipe: Recipe) => {
    setOpsSelection(prev => [...prev, recipe]);
    setSearchQuery('');
    setShowDropdown(false);
    setOptimizedResult(null);
    setOpsError(null);
  };

  const removeRecipe = (id: string) => {
    setOpsSelection(prev => prev.filter(r => r.id !== id));
    setOptimizedResult(null);
  };

  const handleApiKeyPrompt = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      addLog("Prompting user for Gemini API Key...");
      await (window as any).aistudio.openSelectKey();
    }
  };

  const checkAndRunOptimizer = async () => {
    if (opsSelection.length === 0) return;
    setOpsError(null);
    setOpsLoading(true);
    addLog("Optimizing plan with Gemini 3 Pro...");

    try {
      // Check if we have an API key context
      const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
      if (!hasKey && !process.env.API_KEY) {
        setOpsError("Gemini requires a valid API key. Please check the System Console to connect.");
        addLog("Error: Missing API Key.");
        setOpsLoading(false);
        return;
      }

      const result = await optimizeCookingOps(opsSelection, cookCount, stoveCount);
      setOptimizedResult(result);
      addLog("Success: Cooking plan generated.");
      
      setTimeout(() => {
        document.getElementById('ops-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
      setOpsError(e.message || "Failed to connect to the cooking brain.");
    } finally {
      setOpsLoading(false);
    }
  };

  const generatePlan = async () => {
    setPlannerError(null);
    setPlannerLoading(true);
    addLog("Generating meal suggestions with Gemini 3 Flash...");
    
    try {
      const suggestedNames = await suggestMealPlan(recipes, fridgeVeggies, plannerDays);
      const newPlan: MealPlanDay[] = [];
      let nameIdx = 0;
      for (let i = 0; i < plannerDays; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        newPlan.push({
          date: date.toISOString().split('T')[0],
          breakfast: recipes.find(r => r.dishName === suggestedNames[nameIdx++]),
          lunchDinner: recipes.find(r => r.dishName === suggestedNames[nameIdx++]),
          snack: recipes.find(r => r.dishName === suggestedNames[nameIdx++]),
        });
      }
      setMealPlan(newPlan);
      addLog("Success: Weekly plan suggested.");
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
      setPlannerError(e.message || "Could not generate suggestions.");
    } finally {
      setPlannerLoading(false);
    }
  };

  const generateShoppingList = () => {
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
          <p className="text-slate-400 font-medium animate-pulse">Opening Kitchen...</p>
        </div>
      </div>
    );
  }

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
          className={`p-2 rounded-lg transition-colors ${showDebug ? 'bg-slate-900 text-green-400' : 'text-slate-400'}`}
        >
          <Terminal size={18} />
        </button>
      </header>

      {showDebug && (
        <div className="mb-6 p-4 bg-slate-900 text-green-400 font-mono text-[11px] rounded-2xl overflow-hidden shadow-xl border border-slate-800 animate-in zoom-in-95">
           <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
            <span className="flex items-center gap-2 uppercase tracking-widest"><Terminal size={12}/> System Console</span>
            <button onClick={handleApiKeyPrompt} className="bg-orange-600 text-white px-2 py-0.5 rounded flex items-center gap-1 hover:bg-orange-500">
              <Key size={10} /> Link API Key
            </button>
           </div>
           <div className="space-y-1 mb-4">
             <p><span className="text-slate-500">USER:</span> {auth.currentUser?.uid || 'ANON'}</p>
             <p><span className="text-slate-500">API:</span> {process.env.API_KEY ? 'ACTIVE (EnvVar)' : 'KEY_MISSING'}</p>
             <p><span className="text-slate-500">RECIPES:</span> {recipes.length} Loaded</p>
           </div>
           <div className="bg-black/50 p-2 rounded max-h-32 overflow-y-auto">
             <p className="text-slate-600 mb-1 font-bold">EVENT_LOG:</p>
             {systemLogs.map((log, i) => <p key={i} className="leading-tight mb-1">{log}</p>)}
             {systemLogs.length === 0 && <p className="text-slate-800">No logs yet...</p>}
           </div>
        </div>
      )}

      {/* OPS TAB */}
      {activeTab === 'ops' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Cooking Setup</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <span className="text-xs text-slate-400 font-medium">How many cooks?</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCookCount(Math.max(1, cookCount - 1))} className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center bg-slate-50 text-slate-600 active:bg-slate-100"><Minus size={14} /></button>
                  <span className="text-lg font-bold w-4 text-center">{cookCount}</span>
                  <button onClick={() => setCookCount(Math.min(4, cookCount + 1))} className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center bg-slate-50 text-slate-600 active:bg-slate-100"><Plus size={14} /></button>
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-slate-400 font-medium">Stove Burners</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setStoveCount(Math.max(1, stoveCount - 1))} className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center bg-slate-50 text-slate-600 active:bg-slate-100"><Minus size={14} /></button>
                  <span className="text-lg font-bold w-4 text-center">{stoveCount}</span>
                  <button onClick={() => setStoveCount(Math.min(6, stoveCount + 1))} className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center bg-slate-50 text-slate-600 active:bg-slate-100"><Plus size={14} /></button>
                </div>
              </div>
            </div>

            <div className="relative" ref={searchRef}>
              <span className="text-xs text-slate-400 font-medium block mb-2">What's on the menu?</span>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  placeholder="Find a dish..." 
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                  value={searchQuery}
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => {setSearchQuery(e.target.value); setShowDropdown(true);}}
                />
              </div>

              {showDropdown && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden">
                  {filteredSuggestions.map(r => (
                    <button 
                      key={r.id} 
                      onClick={() => addRecipe(r)}
                      className="w-full px-5 py-4 text-left hover:bg-slate-50 flex justify-between items-center transition-colors"
                    >
                      <span className="font-semibold text-slate-700">{r.dishName}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{r.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {opsSelection.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {opsSelection.map(r => (
                  <div key={r.id} className="flex items-center gap-2 bg-orange-50 border border-orange-100 text-orange-700 pl-3 pr-1 py-1 rounded-full text-xs font-bold animate-in zoom-in-50">
                    {r.dishName}
                    <button onClick={() => removeRecipe(r.id)} className="p-1 hover:bg-orange-100 rounded-full"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {opsError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex gap-3 items-start animate-in shake-in">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 font-medium leading-relaxed">{opsError}</p>
              </div>
            )}

            <button 
              onClick={checkAndRunOptimizer}
              disabled={opsSelection.length === 0 || opsLoading}
              className="w-full mt-6 py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-100 disabled:text-slate-300 text-white font-bold rounded-2xl transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 text-lg active:scale-95"
            >
              {opsLoading ? <RefreshCcw className="animate-spin" size={20} /> : <Flame size={20} />}
              {opsLoading ? 'Optimizing Steps...' : 'Plan My Cooking'}
            </button>
          </div>

          {optimizedResult && (
            <div id="ops-results" className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex justify-between items-center px-2">
                <h3 className="font-bold text-slate-900">Your Step-by-Step</h3>
                <span className="text-[10px] bg-slate-200 text-slate-600 px-3 py-1 rounded-full font-black uppercase tracking-wider">{optimizedResult.totalDuration} Min Total</span>
              </div>
              
              <div className="space-y-3">
                {optimizedResult.timeline.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border-2 transition-all ${step.isParallel ? 'bg-orange-500 text-white border-orange-400 shadow-md' : 'bg-white text-slate-300 border-slate-100'}`}>
                        {step.timeOffset}'
                      </div>
                      {i !== optimizedResult.timeline.length - 1 && <div className="w-0.5 h-full bg-slate-100 my-1"></div>}
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 flex-1 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Assignee: {step.assignees.join(' & ')}</span>
                         {step.isParallel && <span className="text-[8px] font-black text-green-500 bg-green-50 px-2 py-0.5 rounded border border-green-100 uppercase tracking-tighter">Multi-Task</span>}
                      </div>
                      <p className="text-sm font-bold text-slate-800 leading-snug">{step.action}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {step.involvedRecipes.map((r, ri) => (
                          <span key={ri} className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{r}</span>
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
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-lg font-bold text-slate-900">Weekly Planner</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Plan For...</span>
                <span className="text-orange-500 font-black text-lg uppercase tracking-tighter">{plannerDays} Days</span>
              </div>
              <input 
                type="range" min="1" max="7" 
                value={plannerDays}
                onChange={(e) => setPlannerDays(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">In the Fridge?</span>
              <textarea 
                placeholder="e.g. Leftover chicken, carrots, broccoli..." 
                className="w-full p-4 bg-slate-50 border-none rounded-2xl h-24 focus:ring-2 focus:ring-orange-500 transition-all text-sm font-medium resize-none"
                value={fridgeVeggies}
                onChange={(e) => setFridgeVeggies(e.target.value)}
              />
            </div>

            {plannerError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex gap-3 items-start">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 font-medium leading-relaxed">{plannerError}</p>
              </div>
            )}

            <button 
              onClick={generatePlan}
              disabled={plannerLoading || recipes.length === 0}
              className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              {plannerLoading ? <RefreshCcw className="animate-spin" size={20} /> : <Calendar size={20} />}
              {plannerLoading ? 'Thinking...' : 'Suggest a Menu'}
            </button>
          </div>

          {mealPlan.length > 0 && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              {mealPlan.map((day, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Day {idx + 1}</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {['breakfast', 'lunchDinner', 'snack'].map((m) => (
                      <div key={m} className="p-4">
                        <span className="text-[10px] text-orange-500 font-black uppercase block mb-1">{m === 'lunchDinner' ? 'Main' : m}</span>
                        <p className="font-bold text-slate-800">{day[m as keyof MealPlanDay] ? (day[m as keyof MealPlanDay] as Recipe).dishName : 'Reserve Slot'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              <button 
                onClick={generateShoppingList}
                className="w-full py-5 bg-orange-500 text-white font-black rounded-2xl shadow-lg mt-4 flex items-center justify-center gap-2 active:scale-95"
              >
                <ShoppingCart size={20} /> Build Grocery List
              </button>
            </div>
          )}
        </div>
      )}

      {/* SHOPPING TAB */}
      {activeTab === 'shopping' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Grocery List</h2>
              <button onClick={() => setShoppingList(prev => prev.filter(i => !i.checked))} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
            </div>

            <div className="space-y-2">
              {shoppingList.map((item, i) => (
                <div 
                  key={i} 
                  onClick={() => {
                    const newList = [...shoppingList];
                    newList[i].checked = !newList[i].checked;
                    setShoppingList(newList);
                  }}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${item.checked ? 'bg-green-500 border-green-500' : 'bg-white border-slate-200'}`}>
                      {item.checked && <Check size={14} className="text-white" strokeWidth={4} />}
                    </div>
                    <span className={`text-sm font-semibold ${item.checked ? 'text-slate-300 line-through' : 'text-slate-800'}`}>{item.name}</span>
                  </div>
                  <span className="text-[10px] font-black bg-white px-2 py-1 rounded-lg border border-slate-100 text-slate-500">{item.value} {item.unit}</span>
                </div>
              ))}
              {shoppingList.length === 0 && (
                <div className="text-center py-20 text-slate-300 text-sm font-medium flex flex-col items-center gap-3">
                  <ShoppingCart size={40} className="opacity-20" />
                  Your list is empty.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STICKY NAV */}
      <nav className="fixed bottom-6 left-4 right-4 bg-slate-900/95 backdrop-blur-xl py-4 px-8 flex justify-between items-center z-50 shadow-2xl rounded-3xl border border-white/10">
        {[
          { id: 'ops', icon: Flame, label: 'Cook' },
          { id: 'planner', icon: Calendar, label: 'Plan' },
          { id: 'shopping', icon: ShoppingCart, label: 'Buy' }
        ].map(btn => (
          <button 
            key={btn.id}
            onClick={() => setActiveTab(btn.id as any)} 
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === btn.id ? 'text-orange-500 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <btn.icon size={22} strokeWidth={activeTab === btn.id ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">{btn.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;