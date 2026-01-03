
import React from 'react';
import { Recipe } from '../types';
import { Clock, Users, Tag } from 'lucide-react';

interface RecipeCardProps {
  recipe: Recipe;
  isSelected?: boolean;
  onSelect?: (recipe: Recipe) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, isSelected, onSelect }) => {
  return (
    <div 
      onClick={() => onSelect?.(recipe)}
      className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
        isSelected ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-slate-800 text-lg">{recipe.dishName}</h3>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wider">
          {recipe.category}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1 mb-3">
        {recipe.variations.map((v, i) => (
          <span key={i} className="text-[10px] bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded border border-slate-100">
            {v}
          </span>
        ))}
      </div>

      <div className="flex gap-4 text-slate-500 text-sm">
        <div className="flex items-center gap-1">
          <Clock size={14} />
          <span>{recipe.totalTimeMinutes}m</span>
        </div>
        <div className="flex items-center gap-1">
          <Users size={14} />
          <span>Serves {recipe.servings}</span>
        </div>
      </div>
      
      <div className="mt-3">
        <p className="text-xs text-slate-400 font-medium uppercase mb-1">Key Ingredients</p>
        <p className="text-sm text-slate-600 line-clamp-1">
          {recipe.ingredients.map(i => i.name).join(', ')}
        </p>
      </div>
    </div>
  );
};
