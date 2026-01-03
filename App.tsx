
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Utensils, Calendar, ShoppingCart, Settings2, Flame, RefreshCcw, Check, Trash2, Plus, ChevronDown, ChevronUp, Database, WifiOff, AlertCircle, Terminal, ExternalLink, Activity } from 'lucide-react';
import { Recipe, RecipeCategory, MealPlanDay, OptimizedSchedule } from './types';
import { fetchAllRecipes } from './services/recipeService';
import { RecipeCard } from './components/RecipeCard';
import { optimizeCookingOps, suggestMealPlan } from './services/geminiService';
import { auth, USER_UID } from './firebase';

const App: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'ops' | 'planner' | 'shopping'>('ops');
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Unified Ops Dashboard State
  const [opsSelection, setOpsSelection] = useState<Recipe[]>([]);
  const [cookCount, setCookCount] = useState(2);
  const [stoveCount, setStoveCount] = useState(4);
  const [optimizedResult, setOptimizedResult] = useState<OptimizedSchedule | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Meal Planner State
  const [plannerDays, setPlannerDays] = useState(7);
  const [mealPlan, setMealPlan] = useState<MealPlanDay[]>([]);
  const [fridgeVeggies, setFridgeVeggies] = useState('');
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerServings, setPlannerServings] = useState({ breakfast: 2, lunch: 4, snack: 2 });

  // Shopping List
  const [shoppingList, setShoppingList] = useState<{name: string, value: number, unit: string, checked: boolean}[]>([]);

  const loadData = async () => {
    setLoading(true);
    setConnError(null);
    try {
      const result = await fetchAllRecipes();
      setRecipes(result.data);
      setIsLive(result.isLive);
      if (result.error) setConnError(result.error);
    } catch (e: any) {
      setConnError(e.message || "Unknown fetching error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      const search = searchQuery.toLowerCase();
      const matchesSearch = r.dishName.toLowerCase().includes(search) || 
                          (r.variations && r.variations.some(v => v.toLowerCase().includes(search))) ||
                          (r.ingredients && r.ingredients.some(i => i.name.toLowerCase().includes(search)));
      const matchesCategory = selectedCategory === 'all' || r.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [recipes, searchQuery, selectedCategory]);

  const toggleOpsSelection = (recipe: Recipe) => {
    setOpsSelection(prev => {
      const exists = prev.find(r => r.id === recipe.id);
      const next = exists ? prev.filter(r => r.id !== recipe.id) : [...prev, recipe];
      if (next.length > 0 && !exists) setShowConfig(true);
      return next;
    });
  };

  const runOptimizer = async () => {
    if (opsSelection.length === 0) return;
    setOpsLoading(true);
    try {
      const result = await optimizeCookingOps(opsSelection, cookCount, stoveCount);
      setOptimizedResult(result);
      setTimeout(() => {
        document.getElementById('ops-results')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (e) {
      console.error("Optimization failed:", e);
    } finally {
      setOpsLoading(false);
    }
  };

  const generatePlan = async () => {
    setPlannerLoading(true);
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
    } catch (e) {
      console.error("Planning failed:", e);
    } finally {
      setPlannerLoading(false);
    }
  };

  const generateShoppingList = () => {
    const aggregation: Record<string, { name: string, value: number, unit: string }> = {};
    mealPlan.forEach(day => {
      const meals = [
        { r: day.breakfast, mult: (plannerServings.breakfast || 2) / (day.breakfast?.servings || 1) },
        { r: day.lunchDinner, mult: (plannerServings.lunch || 4) / (day.lunchDinner?.servings || 1) },
        { r: day.snack, mult: (plannerServings.snack || 2) / (day.snack?.servings || 1) }
      ];
      meals.forEach(({ r, mult }) => {
        if (!r) return;
        r.ingredients.forEach(ing => {
          const unit = ing.shopping?.unit || 'pcs';
          const value = ing.shopping?.value || 0;
          const key = `${ing.name.toLowerCase()}-${unit}`;
          if (!aggregation[key]) aggregation[key] = { name: ing.name, value: 0, unit: unit };
          aggregation[key].value += value * mult;
        });
      });
    });
    setShoppingList(Object.values(aggregation).map(item => ({ ...item, checked: false })));
    setActiveTab('shopping');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-6 text-center px-4">
          <div className="relative">
             <Utensils className="animate-bounce text-orange-500" size={64} />
             <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full animate-pulse"></div>
          </div>
          <div>
            <p className="text-slate-900 font-black text-2xl uppercase tracking-[0.2em]">KitchenOps Pro</p>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic">Verifying production deployment...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4 pt-6 min-h-screen">
      {/* VERCEL DEPLOYMENT MONITOR */}
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 rounded-[1.5rem] border border-slate-800 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-1 bg-orange-500 text-white text-[8px] font-black px-2 rounded-bl-lg uppercase">Production</div>
          <div className="flex items-center gap-5">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isLive && recipes.length > 0 ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
              {isLive ? <Activity size={12} className="animate-pulse" /> : <WifiOff size={12} />}
              {isLive && recipes.length > 0 ? 'LIVE CONNECTION' : 'SYNCING DATABASE...'}
            </div>
            {connError && (
              <div className="text-[10px] text-orange-400 font-black flex items-center gap-1.5 max-w-[200px] md:max-w-md truncate">
                <AlertCircle size={14} className="shrink-0" /> {connError}
              </div>
            )}
          </div>
          <button 
            onClick={() => setShowDebug(!showDebug)} 
            className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-white/5 px-3 py-2 rounded-xl"
          >
            <Terminal size={14} /> System Health
          </button>
        </div>

        {showDebug && (
          <div className="p-8 bg-black text-green-400 font-mono text-[12px] rounded-[2rem] shadow-2xl border border-slate-800 animate-in slide-in-from-top-4 duration-500">
            <div className="flex justify-between items-start mb-6 border-b border-green-900/30 pb-4">
              <p className="text-green-600 font-black uppercase tracking-[0.2em]"># SYSTEM_DIAGNOSTICS_v1.0</p>
              <button onClick={loadData} className="text-green-400 hover:text-white flex items-center gap-2 bg-green-900/20 px-4 py-2 rounded-lg border border-green-900/50">
                <RefreshCcw size={14} /> [RE-SYNC_CMS]
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
              <p><span className="text-slate-500 font-bold">PROJECT_TARGET:</span> cooking-ops</p>
              <p><span className="text-slate-500 font-bold">AUTH_UID:</span> {auth.currentUser?.uid || 'INIT_PENDING'}</p>
              <p><span className="text-slate-500 font-bold">CMS_OWNER:</span> {USER_UID}</p>
              <p><span className="text-slate-500 font-bold">ENTITIES_LOADED:</span> {recipes.length}</p>
              <p><span className="text-slate-500 font-bold">GEMINI_ENGINE:</span> gemini-3-flash-preview</p>
              <p><span className="text-slate-500 font-bold">CORS_STATUS:</span> OK_WHITELISTED</p>
            </div>
            <div className="mt-8 p-5 bg-green-950/10 border border-green-900/30 rounded-2xl">
              <p className="text-green-500 font-black mb-2 uppercase text-[10px] tracking-widest">Connection Logic Verification:</p>
              <p className="text-slate-400 leading-relaxed">The app is using <span className="text-white underline">signInAnonymously</span>. Security rules must allow <span className="text-white">read</span> for <span className="text-white">resource.data.ownerId == "{USER_UID}"</span>. If "ENTITIES_LOADED" is 0 but "LIVE CONNECTION" is green, your database is connected but the ownerId field in your documents doesn't match the target UID.</p>
            </div>
          </div>
        )}
      </div>

      <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/20 rotate-3">
               <Flame className="text-white" size={32} />
             </div>
             <div>
               <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">KitchenOps</h1>
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mt-1 ml-0.5">Tactical Kitchen Intelligence</p>
             </div>
          </div>
        </div>
        <div className="bg-white p-1.5 rounded-[1.75rem] shadow-xl border border-slate-100 flex gap-1.5 w-full md:w-auto">
          {(['ops', 'planner'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 md:flex-none px-10 py-4 rounded-[1.5rem] text-xs font-black tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/20' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              {tab === 'ops' ? 'DAILY OPS' : 'PLANNER'}
            </button>
          ))}
        </div>
      </header>

      {/* TABS CONTENT */}
      {activeTab === 'ops' && (
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12">
          
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm shadow-xl">01</span>
                Recipe Inventory
              </h2>
            </div>
            
            <div className="space-y-6">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={24} />
                <input 
                  type="text" 
                  placeholder="Scan library for dishes or variations..." 
                  className="w-full pl-16 pr-8 py-6 rounded-[2.5rem] bg-white border border-slate-100 focus:outline-none focus:ring-8 focus:ring-orange-500/5 focus:border-orange-500/30 transition-all shadow-sm text-lg font-medium placeholder:text-slate-300"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                {['all', 'breakfast', 'lunch/dinner', 'evening snack'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat as any)}
                    className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 ${
                      selectedCategory === cat 
                        ? 'bg-orange-500 border-orange-500 text-white shadow-xl shadow-orange-500/10' 
                        : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredRecipes.map(recipe => (
                  <RecipeCard 
                    key={recipe.id} 
                    recipe={recipe} 
                    isSelected={opsSelection.some(r => r.id === recipe.id)}
                    onSelect={() => toggleOpsSelection(recipe)} 
                  />
                ))}
                {filteredRecipes.length === 0 && !loading && (
                  <div className="col-span-full py-32 text-center bg-white border border-slate-100 rounded-[3rem] space-y-6 shadow-sm">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Utensils className="text-slate-200" size={48} />
                    </div>
                    <div>
                      <p className="text-slate-900 font-black text-2xl uppercase tracking-tighter">Inventory Empty</p>
                      <p className="text-slate-400 text-sm max-w-sm mx-auto mt-2 font-medium px-10">
                        {isLive && recipes.length === 0 
                          ? `Verification Error: No recipes found for target ID ${USER_UID}. Please check your CMS entries.`
                          : "Your current search filters returned zero results."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CAPACITY CONFIG */}
          {opsSelection.length > 0 && (
            <div className="bg-slate-900 text-white rounded-[3rem] p-12 shadow-3xl space-y-12 animate-in slide-in-from-bottom-12 duration-1000 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                 <Settings2 size={200} className="rotate-12" />
              </div>
              
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <h3 className="text-3xl font-black flex items-center gap-5 uppercase tracking-tighter">
                    <span className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center text-sm shadow-2xl shadow-orange-500/50">02</span>
                    Resource Matrix
                  </h3>
                  <p className="text-slate-500 text-[11px] font-black uppercase mt-3 tracking-[0.3em] ml-1">Orchestrating {opsSelection.length} Dishes</p>
                </div>
                <button 
                  onClick={() => setShowConfig(!showConfig)}
                  className="p-5 bg-white/5 hover:bg-white/10 rounded-[1.5rem] transition-all border border-white/5"
                >
                  {showConfig ? <ChevronUp size={28} /> : <ChevronDown size={28} />}
                </button>
              </div>

              {showConfig && (
                <div className="space-y-16 pt-10 border-t border-white/10 animate-in fade-in slide-in-from-top-10 relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Kitchen Staff</span>
                        <span className="bg-orange-500 px-6 py-2 rounded-2xl text-xl font-black text-white shadow-xl shadow-orange-500/20">{cookCount}</span>
                      </div>
                      <input type="range" min="1" max="8" value={cookCount} onChange={(e) => setCookCount(parseInt(e.target.value))} className="w-full h-3 bg-white/5 rounded-full appearance-none cursor-pointer accent-orange-500 border border-white/10" />
                    </div>
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Burner Slots</span>
                        <span className="bg-orange-500 px-6 py-2 rounded-2xl text-xl font-black text-white shadow-xl shadow-orange-500/20">{stoveCount}</span>
                      </div>
                      <input type="range" min="1" max="10" value={stoveCount} onChange={(e) => setStoveCount(parseInt(e.target.value))} className="w-full h-3 bg-white/5 rounded-full appearance-none cursor-pointer accent-orange-500 border border-white/10" />
                    </div>
                  </div>

                  <button 
                    onClick={runOptimizer}
                    disabled={opsLoading}
                    className="w-full py-10 bg-orange-500 hover:bg-orange-400 active:scale-[0.98] disabled:bg-slate-800 text-white font-black rounded-[2.5rem] transition-all shadow-3xl flex items-center justify-center gap-6 text-3xl tracking-tighter uppercase"
                  >
                    {opsLoading ? <RefreshCcw className="animate-spin" size={40} /> : <Flame size={40} />}
                    {opsLoading ? 'Optimizing Critical Path...' : 'Deploy Interleaved Plan'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TIMELINE RESULTS */}
          {optimizedResult && (
            <div id="ops-results" className="space-y-12 pt-12 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-16">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                <h3 className="text-3xl font-black text-slate-900 flex items-center gap-5 uppercase tracking-tighter">
                  <span className="w-12 h-12 rounded-[1.25rem] bg-slate-900 text-white flex items-center justify-center text-sm shadow-2xl">03</span>
                  Tactical Schedule
                </h3>
                <div className="bg-white border-2 border-slate-50 p-8 rounded-[3rem] shadow-sm flex items-center gap-10">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-300 uppercase font-black tracking-[0.2em] mb-1">Duration</p>
                    <p className="text-4xl font-black text-slate-900 leading-none">{optimizedResult.totalDuration}<span className="text-xs ml-1 text-slate-400">MIN</span></p>
                  </div>
                  <div className="w-px h-12 bg-slate-100"></div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-300 uppercase font-black tracking-[0.2em] mb-1">Efficiency</p>
                    <p className="text-4xl font-black text-orange-500 leading-none">{optimizedResult.timeline.filter(s => s.isParallel).length}<span className="text-xs ml-1 text-orange-300">OPS</span></p>
                  </div>
                </div>
              </div>

              <div className="space-y-10 relative">
                {optimizedResult.timeline.map((step, i) => (
                  <div key={i} className="flex gap-10 relative group">
                    {i !== optimizedResult.timeline.length - 1 && (
                      <div className="absolute left-[31px] top-20 w-1 h-[calc(100%+2.5rem)] bg-slate-100 group-hover:bg-orange-100 transition-all duration-500"></div>
                    )}
                    <div className={`w-16 h-16 rounded-[1.5rem] shrink-0 flex items-center justify-center font-black text-xl z-10 transition-all shadow-2xl border-4 ${step.isParallel ? 'bg-orange-500 border-orange-400 text-white rotate-6 scale-110 shadow-orange-500/20' : 'bg-white border-slate-50 text-slate-300'}`}>
                      {step.timeOffset}'
                    </div>
                    <div className="bg-white flex-1 p-10 rounded-[3rem] border border-slate-100 shadow-sm group-hover:border-orange-200 group-hover:shadow-3xl transition-all duration-500 group-hover:-translate-x-2">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex flex-wrap gap-3">
                          <span className="text-[11px] font-black text-orange-600 bg-orange-50 px-5 py-2 rounded-2xl uppercase tracking-[0.1em] border border-orange-100 shadow-sm">
                            Cook {step.assignees.join(' + ')}
                          </span>
                          <span className="text-[11px] font-black text-slate-500 bg-slate-50 px-5 py-2 rounded-2xl uppercase tracking-[0.1em] border border-slate-100">
                            {step.resourceUsed || 'Ops Center'}
                          </span>
                        </div>
                        {step.isParallel && (
                          <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-2xl border border-green-100">
                             <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
                             <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Parallel Execution</span>
                          </div>
                        )}
                      </div>
                      <p className="font-black text-slate-900 text-3xl leading-tight mb-8 tracking-tighter">{step.action}</p>
                      <div className="flex flex-wrap gap-3">
                        {step.involvedRecipes.map((r, ri) => (
                          <div key={ri} className="flex items-center gap-2 text-[10px] bg-slate-100 text-slate-400 px-4 py-1.5 rounded-full font-black uppercase tracking-widest">
                            <Utensils size={10} /> {r}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* PLANNER TAB IS IDENTICAL IN LOGIC BUT UPDATED STYLING */}
      {activeTab === 'planner' && (
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12">
           <div className="bg-white p-12 rounded-[4rem] shadow-2xl border border-slate-50 space-y-12 relative overflow-hidden">
             <div className="absolute -top-10 -right-10 w-64 h-64 bg-orange-50 rounded-full blur-3xl opacity-50"></div>
             <h2 className="font-black text-4xl flex items-center gap-5 text-slate-900 tracking-tighter uppercase relative z-10">
               <Calendar className="text-orange-500" size={40} /> Strategic Planner
             </h2>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-20 relative z-10">
               <div className="space-y-10">
                 <div className="space-y-8">
                   <div className="flex justify-between items-end">
                     <label className="block text-[11px] font-black text-slate-300 uppercase tracking-[0.3em]">Temporal Window</label>
                     <span className="text-orange-500 text-2xl font-black">{plannerDays} Days</span>
                   </div>
                   <input 
                     type="range" min="2" max="7" 
                     value={plannerDays}
                     onChange={(e) => setPlannerDays(parseInt(e.target.value))}
                     className="w-full h-4 bg-slate-50 rounded-full appearance-none cursor-pointer accent-orange-500 border border-slate-100 shadow-inner"
                   />
                 </div>
                 
                 <div className="grid grid-cols-3 gap-6 bg-slate-50 p-8 rounded-[3rem] border border-slate-100 shadow-inner">
                   {Object.entries(plannerServings).map(([key, val]) => (
                     <div key={key} className="space-y-4">
                       <label className="block text-[9px] font-black text-slate-400 uppercase text-center tracking-[0.2em]">{key}</label>
                       <input 
                         type="number" 
                         className="w-full bg-white border border-slate-100 rounded-[1.5rem] py-4 text-center text-2xl font-black focus:ring-8 focus:ring-orange-500/5 transition-all shadow-sm" 
                         value={val} 
                         onChange={e => setPlannerServings({...plannerServings, [key]: parseInt(e.target.value) || 0})} 
                       />
                     </div>
                   ))}
                 </div>
               </div>
               
               <div className="space-y-6">
                 <label className="block text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] ml-1">Asset Intelligence (Fridge Contents)</label>
                 <textarea 
                   placeholder="Describe current stock: e.g., leftover roast chicken, prime spinach..." 
                   className="w-full p-8 bg-slate-50 border border-slate-100 rounded-[3rem] text-xl focus:outline-none focus:ring-12 focus:ring-orange-500/5 focus:border-orange-500/30 h-60 transition-all resize-none font-bold placeholder:text-slate-200 shadow-inner"
                   value={fridgeVeggies}
                   onChange={(e) => setFridgeVeggies(e.target.value)}
                 />
               </div>
             </div>

             <button 
               onClick={generatePlan}
               disabled={plannerLoading || recipes.length === 0}
               className="w-full py-10 bg-slate-900 text-white font-black rounded-[3rem] transition-all shadow-3xl hover:bg-slate-800 flex items-center justify-center gap-6 text-3xl tracking-tighter uppercase relative group"
             >
               {plannerLoading ? <RefreshCcw className="animate-spin" size={40} /> : <Calendar size={40} />}
               {recipes.length === 0 ? 'Connection Required' : (mealPlan.length > 0 ? 'Regenerate Strategy' : 'Initialize Plan')}
             </button>
           </div>

           {mealPlan.length > 0 && (
             <div className="space-y-12 animate-in fade-in slide-in-from-bottom-12">
                <div className="grid grid-cols-1 gap-10">
                  {mealPlan.map((day, idx) => (
                    <div key={idx} className="bg-white border border-slate-100 rounded-[4rem] overflow-hidden shadow-sm flex flex-col md:flex-row group hover:shadow-4xl transition-all duration-700 hover:-translate-y-2">
                      <div className="bg-slate-900 text-white md:w-40 flex md:flex-col items-center justify-center p-12 gap-2">
                        <span className="text-[14px] font-black uppercase opacity-30 tracking-[0.4em]">Unit</span>
                        <span className="text-7xl font-black tracking-tighter">{idx + 1}</span>
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-50">
                        {(['breakfast', 'lunchDinner', 'snack'] as const).map(m => (
                          <div key={m} className="p-12 space-y-4 hover:bg-slate-50 transition-all duration-500">
                            <span className="text-[11px] font-black text-orange-500 uppercase tracking-[0.3em] block mb-3">
                              {m === 'lunchDinner' ? 'Dinner Block' : m.toUpperCase()}
                            </span>
                            <p className="font-black text-slate-900 text-3xl leading-none tracking-tighter">{day[m]?.dishName || 'Reserve Slot'}</p>
                            <div className="flex items-center gap-3 pt-4">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{plannerServings[m === 'lunchDinner' ? 'lunch' : m]} Active Units</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={generateShoppingList}
                  className="w-full py-12 bg-orange-500 text-white font-black rounded-[3.5rem] hover:bg-orange-400 shadow-4xl transition-all flex items-center justify-center gap-6 active:scale-[0.98] text-3xl tracking-tighter uppercase"
                >
                  <ShoppingCart size={44} className="text-white shadow-2xl" />
                  Aggregate Logistics (Grocery List)
                </button>
             </div>
           )}
        </section>
      )}

      {/* SHOPPING LIST TAB UPDATED */}
      {activeTab === 'shopping' && (
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="bg-white p-12 rounded-[4rem] shadow-4xl border border-slate-50 space-y-12">
            <div className="flex justify-between items-center">
              <h2 className="font-black text-4xl flex items-center gap-6 text-slate-900 tracking-tighter uppercase">
                <ShoppingCart className="text-orange-500" size={44} /> Logistics Report
              </h2>
              <button 
                onClick={() => setShoppingList(prev => prev.filter(i => !i.checked))}
                className="text-[11px] font-black text-slate-400 hover:text-red-500 uppercase tracking-[0.3em] transition-all bg-slate-50 px-8 py-4 rounded-[1.5rem] border border-slate-100 flex items-center gap-3"
              >
                <Trash2 size={20} /> Clear Verified
              </button>
            </div>

            <div className="space-y-3 pt-10 border-t border-slate-50">
              {shoppingList.map((item, i) => (
                <div 
                  key={i} 
                  onClick={() => {
                    const newList = [...shoppingList];
                    newList[i].checked = !newList[i].checked;
                    setShoppingList(newList);
                  }}
                  className="py-8 flex items-center justify-between cursor-pointer group px-10 hover:bg-slate-50 rounded-[3rem] transition-all duration-500"
                >
                  <div className="flex items-center gap-8">
                    <div className={`w-12 h-12 rounded-[1.25rem] border-4 flex items-center justify-center transition-all duration-500 ${item.checked ? 'bg-green-500 border-green-500 rotate-12 scale-110 shadow-2xl shadow-green-500/20' : 'border-slate-100 group-hover:border-slate-300 bg-white shadow-inner'}`}>
                      {item.checked && <Check size={32} className="text-white" strokeWidth={5} />}
                    </div>
                    <span className={`text-3xl font-black tracking-tighter transition-all duration-500 ${item.checked ? 'text-slate-200 line-through' : 'text-slate-900'}`}>
                      {item.name}
                    </span>
                  </div>
                  <div className={`px-8 py-3.5 rounded-[1.5rem] text-[18px] font-black transition-all duration-500 ${item.checked ? 'bg-slate-50 text-slate-300' : 'bg-orange-50 text-orange-600 border border-orange-100 shadow-sm'}`}>
                    {Math.round(item.value * 100) / 100} <span className="text-[12px] opacity-40 font-black uppercase ml-1">{item.unit}</span>
                  </div>
                </div>
              ))}
              {shoppingList.length === 0 && (
                <div className="py-40 text-center space-y-10">
                   <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mx-auto shadow-inner relative">
                      <ShoppingCart className="text-slate-100" size={64} />
                      <div className="absolute inset-0 bg-slate-100/50 rounded-full animate-ping"></div>
                   </div>
                   <div>
                     <p className="text-slate-900 font-black text-3xl uppercase tracking-widest">Logistics Ready</p>
                     <p className="text-slate-400 text-lg mt-4 max-w-sm mx-auto font-medium leading-relaxed">Your supply chain is optimized. Generate a plan to populate the tactical grocery list.</p>
                   </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setActiveTab('planner')}
              className="w-full py-10 text-slate-300 font-black border-4 border-slate-50 rounded-[3rem] hover:bg-slate-50 transition-all uppercase text-[14px] tracking-[0.5em]"
            >
              Return to Control Panel
            </button>
          </div>
        </section>
      )}

      {/* STICKY NAV REFINED */}
      <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-3xl border border-white/10 py-6 px-16 flex justify-between items-center gap-24 z-50 shadow-[0_30px_100px_rgba(0,0,0,0.6)] rounded-[3.5rem]">
        {[
          { id: 'ops', label: 'OPS', icon: Flame },
          { id: 'planner', label: 'PLAN', icon: Calendar },
          { id: 'shopping', label: 'STOCK', icon: ShoppingCart }
        ].map(btn => (
          <button 
            key={btn.id}
            onClick={() => setActiveTab(btn.id as any)} 
            className={`flex flex-col items-center gap-3 transition-all duration-500 ${activeTab === btn.id ? 'text-orange-500 scale-125' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <btn.icon size={36} strokeWidth={activeTab === btn.id ? 2.5 : 2} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{btn.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
