import { Button } from "@/components/ui/button";
import { Pause, Play, X, Loader2, Copy, Trash2, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface CampaignActionsProps {
  status: string;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  loadingPause?: boolean;
  loadingResume?: boolean;
  loadingCancel?: boolean;
}

export function CampaignActions({ 
  status, 
  onPause, 
  onResume, 
  onCancel,
  onDuplicate,
  onDelete,
  onEdit,
  loadingPause = false,
  loadingResume = false,
  loadingCancel = false,
}: CampaignActionsProps) {
  const canEdit = status === 'DRAFT' || status === 'SCHEDULED';
  const canDelete = status === 'DRAFT' || status === 'CANCELLED';

  return (
    <div className="flex gap-2 items-center">
      {/* Ações principais */}
      <div className="flex gap-2">
        {status === 'RUNNING' && (
          <Button
            size="sm"
            variant="outline"
            disabled={loadingPause || loadingResume || loadingCancel}
            onClick={(e) => {
              e.stopPropagation();
              onPause();
            }}
          >
            {loadingPause ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Pause className="h-4 w-4 mr-1" />
            )}
            Pausar
          </Button>
        )}
        {status === 'PAUSED' && (
          <Button
            size="sm"
            variant="outline"
            disabled={loadingPause || loadingResume || loadingCancel}
            onClick={(e) => {
              e.stopPropagation();
              onResume();
            }}
          >
            {loadingResume ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            Retomar
          </Button>
        )}
        {(status === 'RUNNING' || status === 'PAUSED' || status === 'SCHEDULED') && (
          <Button
            size="sm"
            variant="destructive"
            disabled={loadingPause || loadingResume || loadingCancel}
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
          >
            {loadingCancel ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <X className="h-4 w-4 mr-1" />
            )}
            Cancelar
          </Button>
        )}
      </div>

      {/* Menu de ações adicionais */}
      {(onDuplicate || onEdit || onDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit && onEdit && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
            )}
            {onDuplicate && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar
              </DropdownMenuItem>
            )}
            {canDelete && onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Deletar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
