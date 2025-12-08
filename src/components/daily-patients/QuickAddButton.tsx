import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Calendar, ChevronDown, Zap } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface QuickAddButtonProps {
  onAddClick: (date: Date) => void;
}

export function QuickAddButton({ onAddClick }: QuickAddButtonProps) {
  const today = new Date();
  const yesterday = subDays(today, 1);

  const quickDates = [
    { label: 'Today', date: today, icon: '📅' },
    { label: 'Yesterday', date: yesterday, icon: '📆' },
  ];

  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => onAddClick(today)} className="gap-2 shadow-lg">
        <Zap className="w-4 h-4" />
        Quick Add Today
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Quick Add For
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {quickDates.map((item) => (
            <DropdownMenuItem
              key={item.label}
              onClick={() => onAddClick(item.date)}
              className="cursor-pointer"
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
              <span className="ml-auto text-xs text-muted-foreground">
                {format(item.date, 'MMM d')}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onAddClick(today)}
            className="cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" />
            Choose Date...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
