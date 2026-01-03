
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Utensils, Calendar, ShoppingCart, Settings2, Flame, RefreshCcw, Check, Trash2, Plus, ChevronDown, ChevronUp, Database, WifiOff, AlertCircle, Terminal, ExternalLink } from 'lucide-react';
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
    const result = await fetchAllRecipes();
    setRecipes(result.data);
    setIsLive(result.isLive);
    if (result.error) setConnError(result.error);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      const search = searchQuery.toLowerCase();
      const matchesSearch = r.dishName.toLowerCase().includes(search) || 
                          r.variations.some(v => v.toLowerCase().includes(search)) ||
                          r.ingredients.some(i => i.name.toLowerCase().includes(search));
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
        { r: day.breakfast, mult: plannerServings.breakfast / (day.breakfast?.servings || 1) },
        { r: day.lunchDinner, mult: plannerServings.lunch / (day.lunchDinner?.servings || 1) },
        { r: day.snack, mult: plannerServings.snack / (day.snack?.servings || 1) }
      ];
      meals.forEach(({ r, mult }) => {
        if (!r) return;
        r.ingredients.forEach(ing => {
          const key = `${ing.name.toLowerCase()}-${ing.shopping.unit}`;
          if (!aggregation[key]) aggregation[key] = { name: ing.name, value: 0, unit: ing.shopping.unit };
          aggregation[key].value += ing.shopping.value * mult;
        });
      });
    });
    setShoppingList(Object.values(aggregation).map(item => ({ ...item, checked: false })));
    setActiveTab('shopping');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <Utensils className="animate-bounce text-orange-500" size={48} />
          <div>
            <p className="text-slate-900 font-black text-lg uppercase tracking-widest">KitchenOps Pro</p>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-1 italic">Verifying cooking-ops.firebaseapp.com...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4 pt-6 min-h-screen">
      {/* DEPLOYMENT & CONNECTION DEBUGGER */}
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${isLive && recipes.length > 0 ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
              {isLive ? <Database size={12} /> : <WifiOff size={12} />}
              {isLive && recipes.length > 0 ? 'LIVE CONNECTION' : 'CHECKING CMS...'}
            </div>
            {connError && (
              <div className="text-[10px] text-orange-400 font-bold flex items-center gap-1.5 max-w-[200px] truncate">
                <AlertCircle size={12} /> {connError}
              </div>
            )}
          </div>
          <button 
            onClick={() => setShowDebug(!showDebug)} 
            className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest flex items-center gap-2 transition-colors"
          >
            <Terminal size={14} /> System Console
          </button>
        </div>

        {showDebug && (
          <div className="p-6 bg-black text-green-400 font-mono text-[11px] rounded-2xl shadow-2xl border border-slate-800 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-start mb-4 border-b border-green-900/30 pb-2">
              <p className="text-green-600 font-bold uppercase tracking-widest"># Environment: PRODUCTION_VERCEL</p>
              <button onClick={loadData} className="text-green-400 hover:text-white flex items-center gap-1">
                <RefreshCcw size={12} /> [RE-SYNC]
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1">
              <p><span className="text-slate-500">PROJECT_ID:</span> cooking-ops</p>
              <p><span className="text-slate-500">AUTH_UID:</span> {auth.currentUser?.uid || 'NONE'}</p>
              <p><span className="text-slate-500">TARGET_OWNER:</span> {USER_UID}</p>
              <p><span className="text-slate-500">RECORDS_FOUND:</span> {recipes.length}</p>
            </div>
            <div className="mt-4 p-3 bg-green-950/20 border border-green-900/50 rounded-lg">
              <p className="text-green-500 font-bold">DEPLOYMENT CHECKLIST:</p>
              <p className="text-slate-400">1. Firestore Collection Name: <span className="text-white">"recipes"</span></p>
              <p className="text-slate-400">2. Documents must have field: <span className="text-white">ownerId == "{USER_UID}"</span></p>
              <p className="text-slate-400">3. Vercel Env Var: <span className="text-white">API_KEY (for Gemini AI)</span></p>
            </div>
          </div>
        )}
      </div>

      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <Flame className="text-orange-500" size={36} /> KITCHEN OPS
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-1 ml-1">Professional Resource Interleaving</p>
        </div>
        <div className="bg-white p-1.5 rounded-[1.5rem] shadow-lg border border-slate-200 flex gap-1 w-full md:w-auto">
          {(['ops', 'planner'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 md:flex-none px-8 py-3 rounded-[1.25rem] text-sm font-black transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {tab === 'ops' ? 'DAILY OPS' : 'WEEKLY PLAN'}
            </button>
          ))}
        </div>
      </header>

      {/* DAILY OPS TAB */}
      {activeTab === 'ops' && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
          
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center text-sm shadow-lg shadow-orange-100">1</span>
                Recipe Selection
              </h2>
            </div>
            
            <div className="space-y-4">
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={24} />
                <input 
                  type="text" 
                  placeholder="Fuzzy search dish, variations, or ingredients..." 
                  className="w-full pl-14 pr-6 py-5 rounded-[2rem] bg-white border border-slate-200 focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all shadow-sm text-lg font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                {['all', 'breakfast', 'lunch/dinner', 'evening snack'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat as any)}
                    className={`px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all border-2 ${
                      selectedCategory === cat 
                        ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100' 
                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredRecipes.map(recipe => (
                  <RecipeCard 
                    key={recipe.id} 
                    recipe={recipe} 
                    isSelected={opsSelection.some(r => r.id === recipe.id)}
                    onSelect={() => toggleOpsSelection(recipe)} 
                  />
                ))}
                {filteredRecipes.length === 0 && !loading && (
                  <div className="col-span-full py-24 text-center bg-white border-2 border-dashed border-slate-200 rounded-[3rem] space-y-4">
                    <Utensils className="mx-auto text-slate-200" size={64} />
                    <div>
                      <p className="text-slate-900 font-black text-xl">No Recipes Found</p>
                      <p className="text-slate-400 text-sm max-w-xs mx-auto mt-1">
                        {isLive && recipes.length === 0 
                          ? `Database 'recipes' is empty for ownerId: ${USER_UID}`
                          : "Try adjusting your search filters"}
                      </p>
                    </div>
                    {isLive && recipes.length === 0 && (
                      <a 
                        href="https://console.firebase.google.com" 
                        target="_blank" 
                        className="inline-flex items-center gap-2 text-xs font-black text-orange-500 uppercase tracking-widest pt-4"
                      >
                        Open Firebase Console <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STEP 2: CONFIGURE RESOURCES */}
          {opsSelection.length > 0 && (
            <div className="bg-slate-900 text-white rounded-[3rem] p-10 shadow-2xl space-y-10 animate-in slide-in-from-bottom-12 duration-700 border border-slate-800">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black flex items-center gap-4">
                    <span className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center text-sm">2</span>
                    Capacity Planning
                  </h3>
                  <p className="text-slate-400 text-sm font-bold uppercase mt-2 tracking-widest ml-14">Interleaving {opsSelection.length} selected dishes</p>
                </div>
                <button 
                  onClick={() => setShowConfig(!showConfig)}
                  className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all"
                >
                  {showConfig ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </button>
              </div>

              {showConfig && (
                <div className="space-y-12 pt-6 border-t border-white/5 animate-in fade-in slide-in-from-top-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Cooks</span>
                        <span className="bg-orange-500 px-5 py-1.5 rounded-full text-lg font-black text-white">{cookCount}</span>
                      </div>
                      <input type="range" min="1" max="8" value={cookCount} onChange={(e) => setCookCount(parseInt(e.target.value))} className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                    </div>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Heat Sources</span>
                        <span className="bg-orange-500 px-5 py-1.5 rounded-full text-lg font-black text-white">{stoveCount}</span>
                      </div>
                      <input type="range" min="1" max="10" value={stoveCount} onChange={(e) => setStoveCount(parseInt(e.target.value))} className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                    </div>
                  </div>

                  <button 
                    onClick={runOptimizer}
                    disabled={opsLoading}
                    className="w-full py-8 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] disabled:bg-slate-800 text-white font-black rounded-[2rem] transition-all shadow-2xl flex items-center justify-center gap-4 text-2xl tracking-tighter"
                  >
                    {opsLoading ? <RefreshCcw className="animate-spin" size={32} /> : <Flame size={32} />}
                    {opsLoading ? 'GENERATING CRITICAL PATH...' : 'EXECUTE OPS OPTIMIZATION'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: RESULTS */}
          {optimizedResult && (
            <div id="ops-results" className="space-y-10 pt-10 border-t border-slate-200 animate-in fade-in slide-in-from-bottom-12">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <h3 className="text-3xl font-black text-slate-900 flex items-center gap-4">
                  <span className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm shadow-xl">3</span>
                  Interleaved Timeline
                </h3>
                <div className="bg-white border-2 border-slate-200 px-8 py-5 rounded-[2rem] shadow-sm flex items-center gap-8">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Total Ops Time</p>
                    <p className="text-3xl font-black text-slate-900">{optimizedResult.totalDuration} <span className="text-sm font-bold text-slate-400">MIN</span></p>
                  </div>
                  <div className="w-px h-10 bg-slate-100"></div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Parallelism</p>
                    <p className="text-3xl font-black text-orange-500">{optimizedResult.timeline.filter(s => s.isParallel).length} <span className="text-sm font-bold text-orange-200">STEPS</span></p>
                  </div>
                </div>
              </div>

              <div className="space-y-8 relative">
                {optimizedResult.timeline.map((step, i) => (
                  <div key={i} className="flex gap-8 relative group">
                    {i !== optimizedResult.timeline.length - 1 && (
                      <div className="absolute left-[27px] top-16 w-0.5 h-[calc(100%+2rem)] bg-slate-200 group-hover:bg-orange-200 transition-colors"></div>
                    )}
                    <div className={`w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center font-black text-lg z-10 transition-all shadow-lg border-2 ${step.isParallel ? 'bg-orange-500 border-orange-400 text-white rotate-6 scale-110' : 'bg-white border-slate-200 text-slate-400'}`}>
                      {step.timeOffset}'
                    </div>
                    <div className="bg-white flex-1 p-8 rounded-[2.5rem] border border-slate-200 shadow-sm group-hover:border-orange-200 group-hover:shadow-xl transition-all duration-300">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-wrap gap-2">
                          <span className="text-[11px] font-black text-orange-600 bg-orange-50 px-4 py-1.5 rounded-full uppercase tracking-widest border border-orange-100">
                            Chef Assignees: {step.assignees.join(' & ')}
                          </span>
                          <span className="text-[11px] font-black text-slate-500 bg-slate-50 px-4 py-1.5 rounded-full uppercase tracking-widest border border-slate-100">
                            {step.resourceUsed || 'Preparation Station'}
                          </span>
                        </div>
                        {step.isParallel && (
                          <span className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full uppercase flex items-center gap-2 border border-green-100 animate-pulse">
                            <Plus size={10} strokeWidth={4} /> Multi-Tasking
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900 text-2xl leading-tight mb-6">{step.action}</p>
                      <div className="flex flex-wrap gap-3">
                        {step.involvedRecipes.map((r, ri) => (
                          <span key={ri} className="text-[11px] bg-slate-100 text-slate-500 px-4 py-1.5 rounded-2xl uppercase font-black">
                            {r}
                          </span>
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

      {/* PLANNER TAB */}
      {activeTab === 'planner' && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
          <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-10">
            <h2 className="font-black text-3xl flex items-center gap-4 text-slate-900">
              <Calendar className="text-orange-500" size={32} /> AI Meal Orchestrator
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <div className="space-y-8">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Plan Horizon</label>
                  <input 
                    type="range" min="2" max="7" 
                    value={plannerDays}
                    onChange={(e) => setPlannerDays(parseInt(e.target.value))}
                    className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 font-black mt-3">
                    <span>WEEKEND (2D)</span>
                    <span className="text-orange-500 text-lg">{plannerDays} FULL DAYS</span>
                    <span>WEEKLY (7D)</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  {Object.entries(plannerServings).map(([key, val]) => (
                    <div key={key} className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase text-center">{key}</label>
                      <input 
                        type="number" 
                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 text-center text-lg font-black focus:ring-4 focus:ring-orange-500/10 transition-all" 
                        value={val} 
                        onChange={e => setPlannerServings({...plannerServings, [key]: parseInt(e.target.value) || 0})} 
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-4">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Inventory Intelligence</label>
                <textarea 
                  placeholder="Tell Gemini what's in your fridge (e.g., leftover spinach, 3 salmon fillets)..." 
                  className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-lg focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 h-44 transition-all resize-none font-medium placeholder:text-slate-300"
                  value={fridgeVeggies}
                  onChange={(e) => setFridgeVeggies(e.target.value)}
                />
              </div>
            </div>

            <button 
              onClick={generatePlan}
              disabled={plannerLoading || recipes.length === 0}
              className="w-full py-6 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-100 disabled:text-slate-300 text-white font-black rounded-[2rem] transition-all shadow-2xl flex items-center justify-center gap-4 text-2xl tracking-tighter"
            >
              {plannerLoading ? <RefreshCcw className="animate-spin" size={28} /> : <Calendar size={28} />}
              {recipes.length === 0 ? 'PLEASE CONNECT CMS FIRST' : (mealPlan.length > 0 ? 'RE-OPTIMIZE MEAL PLAN' : 'GENERATE AI MEAL PLAN')}
            </button>
          </div>

          {mealPlan.length > 0 && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 gap-8">
                {mealPlan.map((day, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-sm flex flex-col md:flex-row group hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
                    <div className="bg-slate-900 text-white md:w-32 flex md:flex-col items-center justify-center p-8 gap-1">
                      <span className="text-[12px] font-black uppercase opacity-40 tracking-widest">Day</span>
                      <span className="text-5xl font-black">{idx + 1}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                      {(['breakfast', 'lunchDinner', 'snack'] as const).map(m => (
                        <div key={m} className="p-10 space-y-3 hover:bg-slate-50 transition-colors">
                          <span className="text-[11px] font-black text-orange-500 uppercase tracking-[0.2em] block mb-2">
                            {m === 'lunchDinner' ? 'LUNCH/DINNER' : m.toUpperCase()}
                          </span>
                          <p className="font-black text-slate-900 text-2xl leading-tight">{day[m]?.dishName || 'Unassigned'}</p>
                          <div className="flex items-center gap-2 pt-2">
                            <span className="w-2 h-2 rounded-full bg-slate-200"></span>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{plannerServings[m === 'lunchDinner' ? 'lunch' : m]} Planned Serves</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={generateShoppingList}
                className="w-full py-8 bg-slate-900 text-white font-black rounded-[2.5rem] hover:bg-slate-800 hover:shadow-2xl transition-all flex items-center justify-center gap-4 shadow-xl active:scale-[0.99] text-2xl tracking-tighter"
              >
                <ShoppingCart size={32} className="text-orange-500" />
                BUILD CONSOLIDATED GROCERY LIST
              </button>
            </div>
          )}
        </section>
      )}

      {/* SHOPPING LIST TAB */}
      {activeTab === 'shopping' && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200 space-y-10">
            <div className="flex justify-between items-center">
              <h2 className="font-black text-3xl flex items-center gap-4 text-slate-900">
                <ShoppingCart className="text-orange-500" size={32} /> Consolidated Groceries
              </h2>
              <button 
                onClick={() => setShoppingList(prev => prev.filter(i => !i.checked))}
                className="text-[11px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors flex items-center gap-2 bg-slate-50 px-5 py-2.5 rounded-2xl"
              >
                <Trash2 size={18} /> Purge Purchased
              </button>
            </div>

            <div className="space-y-2 pt-6 border-t border-slate-100">
              {shoppingList.map((item, i) => (
                <div 
                  key={i} 
                  onClick={() => {
                    const newList = [...shoppingList];
                    newList[i].checked = !newList[i].checked;
                    setShoppingList(newList);
                  }}
                  className="py-6 flex items-center justify-between cursor-pointer group px-8 hover:bg-slate-50 rounded-[2rem] transition-all duration-300"
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-9 h-9 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 ${item.checked ? 'bg-green-500 border-green-500 rotate-12 scale-110 shadow-lg shadow-green-100' : 'border-slate-200 group-hover:border-slate-400 bg-white'}`}>
                      {item.checked && <Check size={24} className="text-white" strokeWidth={4} />}
                    </div>
                    <span className={`text-2xl font-black transition-all duration-300 ${item.checked ? 'text-slate-300 line-through' : 'text-slate-900'}`}>
                      {item.name}
                    </span>
                  </div>
                  <div className={`px-6 py-2.5 rounded-2xl text-[14px] font-black transition-all duration-300 ${item.checked ? 'bg-slate-100 text-slate-400' : 'bg-orange-50 text-orange-600 border border-orange-100 shadow-sm'}`}>
                    {Math.round(item.value * 100) / 100} <span className="text-[10px] opacity-60 uppercase">{item.unit}</span>
                  </div>
                </div>
              ))}
              {shoppingList.length === 0 && (
                <div className="py-32 text-center space-y-6">
                   <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto shadow-inner">
                      <ShoppingCart className="text-slate-200" size={44} />
                   </div>
                   <div>
                     <p className="text-slate-900 font-black text-2xl uppercase tracking-widest">Inventory is Optimized</p>
                     <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">Generate a meal plan to automatically populate your shopping list with aggregated quantities.</p>
                   </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setActiveTab('planner')}
              className="w-full py-6 text-slate-400 font-black border-2 border-slate-100 rounded-[2rem] hover:bg-slate-50 transition-all uppercase text-[12px] tracking-[0.3em]"
            >
              Return to Planner
            </button>
          </div>
        </section>
      )}

      {/* STICKY NAVIGATION */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-2xl border border-white/10 py-5 px-12 flex justify-between items-center gap-16 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.4)] rounded-[3rem]">
        {[
          { id: 'ops', label: 'DAILY OPS', icon: Flame },
          { id: 'planner', label: 'PLANNER', icon: Calendar },
          { id: 'shopping', label: 'GROCERIES', icon: ShoppingCart }
        ].map(btn => (
          <button 
            key={btn.id}
            onClick={() => setActiveTab(btn.id as any)} 
            className={`flex flex-col items-center gap-2 transition-all duration-300 ${activeTab === btn.id ? 'text-orange-500 scale-125' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <btn.icon size={28} strokeWidth={activeTab === btn.id ? 2.5 : 2} />
            <span className="text-[10px] font-black uppercase tracking-widest">{btn.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
