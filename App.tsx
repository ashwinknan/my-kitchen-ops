
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Utensils, Calendar, ShoppingCart, Settings2, Flame, RefreshCcw, Check, Trash2, Plus, ChevronDown, ChevronUp, Database, WifiOff } from 'lucide-react';
import { Recipe, RecipeCategory, MealPlanDay, OptimizedSchedule } from './types';
import { fetchAllRecipes } from './services/recipeService';
import { RecipeCard } from './components/RecipeCard';
import { optimizeCookingOps, suggestMealPlan } from './services/geminiService';

const App: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'ops' | 'planner' | 'shopping'>('ops');
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

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

  useEffect(() => {
    const load = async () => {
      const { data, isLive: liveStatus } = await fetchAllRecipes();
      setRecipes(data);
      setIsLive(liveStatus);
      setLoading(false);
    };
    load();
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
          <div className="relative">
            <Utensils className="animate-bounce text-orange-500" size={48} />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full animate-ping"></div>
          </div>
          <div>
            <p className="text-slate-900 font-black text-lg uppercase tracking-widest">KitchenOps Pro</p>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-1">Bootstrapping Kitchen Resources...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4 pt-6 min-h-screen">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
            <Flame className="text-orange-500" size={32} /> KITCHEN OPS
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Professional Kitchen Manager</p>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${isLive ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
              {isLive ? <Database size={8} /> : <WifiOff size={8} />}
              {isLive ? 'Live CMS' : 'Local Sandbox'}
            </div>
          </div>
        </div>
        <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-200 flex gap-1 w-full md:w-auto">
          {(['ops', 'planner'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {tab === 'ops' ? 'DAILY OPS' : 'WEEKLY PLAN'}
            </button>
          ))}
        </div>
      </header>

      {/* DAILY OPS: Unified Library & Optimizer */}
      {activeTab === 'ops' && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
          
          {/* STEP 1: BROWSE & SELECT */}
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs">1</span>
                Recipe Selection
              </h2>
              {!isLive && (
                <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                  Showing Demo Recipes
                </span>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Fuzzy search dishes, variations, or ingredients..." 
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['all', 'breakfast', 'lunch/dinner', 'evening snack'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat as any)}
                    className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                      selectedCategory === cat 
                        ? 'bg-orange-500 border-orange-500 text-white shadow-md' 
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRecipes.map(recipe => (
                  <RecipeCard 
                    key={recipe.id} 
                    recipe={recipe} 
                    isSelected={opsSelection.some(r => r.id === recipe.id)}
                    onSelect={() => toggleOpsSelection(recipe)} 
                  />
                ))}
                {filteredRecipes.length === 0 && (
                  <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No Matches Found</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STEP 2: CONFIGURE RESOURCES */}
          {opsSelection.length > 0 && (
            <div className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl space-y-8 animate-in slide-in-from-bottom-8 duration-500 border border-slate-800">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs">2</span>
                    Resources & Layout
                  </h3>
                  <p className="text-slate-400 text-xs font-bold uppercase mt-1 tracking-tighter">Selected: {opsSelection.map(r => r.dishName).join(', ')}</p>
                </div>
                <button 
                  onClick={() => setShowConfig(!showConfig)}
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all"
                >
                  {showConfig ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>

              {showConfig && (
                <div className="space-y-10 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Available Cooks</span>
                        <span className="bg-orange-500 px-4 py-1 rounded-full text-sm font-black text-white">{cookCount}</span>
                      </div>
                      <input type="range" min="1" max="8" value={cookCount} onChange={(e) => setCookCount(parseInt(e.target.value))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                    </div>
                    <div className="space-y-5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Stove Burners</span>
                        <span className="bg-orange-500 px-4 py-1 rounded-full text-sm font-black text-white">{stoveCount}</span>
                      </div>
                      <input type="range" min="1" max="10" value={stoveCount} onChange={(e) => setStoveCount(parseInt(e.target.value))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                    </div>
                  </div>

                  <button 
                    onClick={runOptimizer}
                    disabled={opsLoading}
                    className="w-full py-6 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] disabled:bg-slate-800 text-white font-black rounded-[1.25rem] transition-all shadow-xl flex items-center justify-center gap-3 text-xl tracking-tight"
                  >
                    {opsLoading ? <RefreshCcw className="animate-spin" /> : <Flame size={28} />}
                    {opsLoading ? 'INTERLEAVING OPS...' : 'GENERATE EXECUTION PLAN'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: RESULTS */}
          {optimizedResult && (
            <div id="ops-results" className="space-y-8 pt-6 border-t border-slate-200 animate-in fade-in slide-in-from-bottom-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">3</span>
                  Daily Ops Schedule
                </h3>
                <div className="bg-white border border-slate-200 px-6 py-3 rounded-2xl shadow-sm text-center md:text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Estimated Duration</p>
                  <p className="text-2xl font-black text-slate-900">{optimizedResult.totalDuration} Min</p>
                </div>
              </div>

              <div className="space-y-6">
                {optimizedResult.timeline.map((step, i) => (
                  <div key={i} className="flex gap-6 relative group">
                    {i !== optimizedResult.timeline.length - 1 && (
                      <div className="absolute left-[23px] top-12 w-0.5 h-[calc(100%+1.5rem)] bg-slate-200 group-hover:bg-orange-200 transition-colors"></div>
                    )}
                    <div className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center font-black text-sm z-10 transition-all shadow-sm border ${step.isParallel ? 'bg-orange-500 border-orange-400 text-white rotate-3 scale-110 shadow-orange-200' : 'bg-white border-slate-200 text-slate-400'}`}>
                      {step.timeOffset}'
                    </div>
                    <div className="bg-white flex-1 p-6 rounded-[2rem] border border-slate-200 shadow-sm group-hover:border-orange-200 group-hover:shadow-md transition-all">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex gap-2">
                          <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-full uppercase tracking-tighter">
                            Cook {step.assignees.join(', ')}
                          </span>
                          <span className="text-[10px] font-black text-slate-500 bg-slate-50 px-3 py-1 rounded-full uppercase tracking-tighter">
                            {step.resourceUsed || 'Station'}
                          </span>
                        </div>
                        {step.isParallel && (
                          <span className="text-[9px] font-black text-green-600 bg-green-50 px-2.5 py-1 rounded-full uppercase flex items-center gap-1.5 border border-green-100 animate-pulse">
                            <Plus size={8} strokeWidth={4} /> Parallel
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900 text-xl leading-tight mb-4">{step.action}</p>
                      <div className="flex flex-wrap gap-2">
                        {step.involvedRecipes.map((r, ri) => (
                          <span key={ri} className="text-[10px] bg-slate-50 text-slate-400 px-3 py-1 rounded-xl uppercase font-bold border border-slate-100">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {optimizedResult.criticalWarnings.length > 0 && (
                <div className="bg-red-50/50 border border-red-100 p-8 rounded-[2rem] space-y-3 mt-10">
                  <p className="text-xs font-black text-red-500 uppercase flex items-center gap-2">
                    <Settings2 size={18} /> Resource Conflict Warnings
                  </p>
                  <ul className="list-disc list-inside text-sm text-red-800 space-y-2 opacity-80">
                    {optimizedResult.criticalWarnings.map((w, i) => <li key={i} className="leading-relaxed">{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* WEEKLY PLANNER TAB */}
      {activeTab === 'planner' && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 space-y-8">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 space-y-8">
            <h2 className="font-black text-2xl flex items-center gap-3 text-slate-900">
              <Calendar className="text-orange-500" size={28} /> AI Meal Planner
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Planning Window</label>
                  <input 
                    type="range" min="2" max="7" 
                    value={plannerDays}
                    onChange={(e) => setPlannerDays(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-black mt-2">
                    <span>2 DAYS</span>
                    <span className="text-orange-500 text-sm">{plannerDays} DAYS</span>
                    <span>7 DAYS</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl">
                  {Object.entries(plannerServings).map(([key, val]) => (
                    <div key={key}>
                      <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">{key.slice(0, 10)} Serves</label>
                      <input 
                        type="number" 
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500/20" 
                        value={val} 
                        onChange={e => setPlannerServings({...plannerServings, [key]: parseInt(e.target.value) || 0})} 
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Inventory Intelligence</label>
                <textarea 
                  placeholder="e.g., spinach, salmon, bell peppers..." 
                  className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 h-32 transition-all resize-none font-medium"
                  value={fridgeVeggies}
                  onChange={(e) => setFridgeVeggies(e.target.value)}
                />
              </div>
            </div>

            <button 
              onClick={generatePlan}
              disabled={plannerLoading}
              className="w-full py-5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 text-white font-black rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 text-lg"
            >
              {plannerLoading ? <RefreshCcw className="animate-spin" /> : <Calendar size={22} />}
              {mealPlan.length > 0 ? 'REGENERATE INTELLIGENT PLAN' : 'GENERATE AI MEAL PLAN'}
            </button>
          </div>

          {mealPlan.length > 0 && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-6">
                {mealPlan.map((day, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm flex flex-col md:flex-row group hover:shadow-md transition-shadow">
                    <div className="bg-slate-900 text-white md:w-28 flex md:flex-col items-center justify-center p-6 gap-0">
                      <span className="text-[10px] font-black uppercase opacity-40">Day</span>
                      <span className="text-4xl font-black">{idx + 1}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                      {(['breakfast', 'lunchDinner', 'snack'] as const).map(m => (
                        <div key={m} className="p-6 space-y-1.5 hover:bg-slate-50/50 transition-colors">
                          <span className="text-[9px] font-black text-orange-500 uppercase tracking-[0.2em]">
                            {m === 'lunchDinner' ? 'LUNCH/DINNER' : m.toUpperCase()}
                          </span>
                          <p className="font-bold text-slate-800 text-lg leading-tight">{day[m]?.dishName || 'No Selection'}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{day[m]?.servings || 0} servings base</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={generateShoppingList}
                className="w-full py-6 bg-slate-900 text-white font-black rounded-[1.5rem] hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-[0.99]"
              >
                <ShoppingCart size={24} className="text-orange-500" />
                CONSOLIDATE ALL INGREDIENTS
              </button>
            </div>
          )}
        </section>
      )}

      {/* SHOPPING LIST TAB */}
      {activeTab === 'shopping' && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="font-black text-2xl flex items-center gap-3 text-slate-900">
                <ShoppingCart className="text-orange-500" size={28} /> Shopping List
              </h2>
              <button 
                onClick={() => setShoppingList(prev => prev.filter(i => !i.checked))}
                className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={16} /> Purge Checked
              </button>
            </div>

            <div className="space-y-1 border-t border-slate-100 pt-4">
              {shoppingList.map((item, i) => (
                <div 
                  key={i} 
                  onClick={() => {
                    const newList = [...shoppingList];
                    newList[i].checked = !newList[i].checked;
                    setShoppingList(newList);
                  }}
                  className="py-5 flex items-center justify-between cursor-pointer group px-4 hover:bg-slate-50 rounded-2xl transition-colors"
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${item.checked ? 'bg-green-500 border-green-500' : 'border-slate-200 group-hover:border-slate-400'}`}>
                      {item.checked && <Check size={18} className="text-white" />}
                    </div>
                    <span className={`text-lg font-bold transition-all ${item.checked ? 'text-slate-300 line-through' : 'text-slate-800'}`}>
                      {item.name}
                    </span>
                  </div>
                  <div className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${item.checked ? 'bg-slate-100 text-slate-400' : 'bg-orange-50 text-orange-600'}`}>
                    {Math.round(item.value * 100) / 100} {item.unit}
                  </div>
                </div>
              ))}
              {shoppingList.length === 0 && (
                <div className="py-24 text-center">
                   <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <ShoppingCart className="text-slate-200" size={32} />
                   </div>
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Pantry Is Optimized</p>
                   <p className="text-slate-300 text-sm mt-1">Generate a plan to populate your grocery list</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setActiveTab('planner')}
              className="w-full py-5 text-slate-400 font-black border-2 border-slate-100 rounded-2xl hover:bg-slate-50 transition-all uppercase text-[10px] tracking-widest"
            >
              Back to Planner
            </button>
          </div>
        </section>
      )}

      {/* STICKY BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-100 py-4 px-10 flex justify-between items-center z-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
        {[
          { id: 'ops', label: 'DAILY OPS', icon: Flame },
          { id: 'planner', label: 'PLANNER', icon: Calendar },
          { id: 'shopping', label: 'GROCERIES', icon: ShoppingCart }
        ].map(btn => (
          <button 
            key={btn.id}
            onClick={() => setActiveTab(btn.id as any)} 
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === btn.id ? 'text-orange-500 scale-110' : 'text-slate-300 hover:text-slate-400'}`}
          >
            <btn.icon size={26} strokeWidth={activeTab === btn.id ? 2.5 : 2} />
            <span className="text-[9px] font-black uppercase tracking-tighter">{btn.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
