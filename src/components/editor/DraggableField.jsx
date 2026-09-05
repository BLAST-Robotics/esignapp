'use client';

import { memo } from 'react';
import { Rnd } from 'react-rnd';
import { FIELD_COLORS } from './constants';

function DraggableField({ field, scale, selected, onSelect, onUpdate, onEdit }) {
  const c = FIELD_COLORS[field.field_type] || FIELD_COLORS.other;
  const pos = { x: (field.x || 0) * scale, y: (field.y || 0) * scale };
  const size = { width: (field.width || 200) * scale, height: (field.height || 40) * scale };

  const commit = (x, y, w, h) => {
    onUpdate({
      ...field,
      x: Math.round((Number.isFinite(x) ? x : field.x) / scale),
      y: Math.round((Number.isFinite(y) ? y : field.y) / scale),
      width: Math.max(50, Math.round((Number.isFinite(w) ? w : field.width) / scale)),
      height: Math.max(30, Math.round((Number.isFinite(h) ? h : field.height) / scale)),
    });
  };

  const labelStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: selected ? c.border : c.bg,
    border: `2px ${selected ? 'solid' : 'dashed'} ${selected ? '#000' : c.border}`,
    borderRadius: '4px',
    fontSize: `${Math.max(8, (field.font_size || 12) * scale)}px`,
    fontWeight: selected ? 600 : 400,
    color: selected ? '#fff' : '#000',
    cursor: 'grab',
    overflow: 'hidden',
    boxSizing: 'border-box',
    userSelect: 'none',
    boxShadow: selected ? '0 4px 16px rgba(0,0,0,0.18)' : 'none',
    padding: '2px',
  };

  const HANDLE_STYLE = {
    width: 10,
    height: 10,
    backgroundColor: '#fff',
    border: '2px solid #000',
    borderRadius: '50%',
    zIndex: 20,
  };

  return (
    <Rnd
      data-field-id={field.id}
      position={pos}
      size={size}
      bounds="parent"
      minWidth={50 * scale}
      minHeight={30 * scale}
      disableDragging={!selected}
      enableResizing={
        selected
          ? {
              top: false,
              right: false,
              bottom: false,
              left: false,
              topLeft: true,
              topRight: true,
              bottomLeft: true,
              bottomRight: true,
            }
          : false
      }
      resizeHandleStyles={{
        topLeft: HANDLE_STYLE,
        topRight: HANDLE_STYLE,
        bottomLeft: HANDLE_STYLE,
        bottomRight: HANDLE_STYLE,
      }}
      style={{ zIndex: selected ? 10 : 1 }}
      onPointerDown={() => onSelect(field.id)}
      onDoubleClick={(e) => {
        e.preventDefault();
        onEdit?.(field.id);
      }}
      onDragStop={(_e, d) => commit(d.x, d.y, size.width, size.height)}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        commit(position.x, position.y, ref.offsetWidth, ref.offsetHeight);
      }}
    >
      <div
        data-field-id={field.id}
        className="h-full w-full flex items-center justify-center select-none"
        style={labelStyle}
      >
        <span
          style={{
            pointerEvents: 'none',
            textAlign: 'center',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {field.label || field.field_type}
        </span>
      </div>
    </Rnd>
  );
}

export default memo(DraggableField);