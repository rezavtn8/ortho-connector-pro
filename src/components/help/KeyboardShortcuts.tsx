import { Keyboard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { keyboardShortcuts } from './helpData';

export function KeyboardShortcuts() {
  const groupedShortcuts = {
    Global: keyboardShortcuts.filter(s => s.category === 'Global'),
    Navigation: keyboardShortcuts.filter(s => s.category === 'Navigation'),
    Actions: keyboardShortcuts.filter(s => s.category === 'Actions'),
  };
  
  return (
    <Card className="border-2">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Keyboard className="h-5 w-5 text-primary" />
          Keyboard Shortcuts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
          <div key={category}>
            <Badge variant="outline" className="mb-3">{category}</Badge>
            <div className="space-y-2">
              {shortcuts.map((shortcut, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm text-muted-foreground">
                    {shortcut.description}
                  </span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <span key={keyIndex} className="flex items-center">
                        <kbd className="px-2.5 py-1.5 bg-muted border border-border rounded-md text-xs font-mono font-semibold text-foreground shadow-sm">
                          {key}
                        </kbd>
                        {keyIndex < shortcut.keys.length - 1 && (
                          <span className="mx-1 text-muted-foreground text-xs">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">?</kbd> anywhere to show this reference
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
