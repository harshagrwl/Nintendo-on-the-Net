( function( emu )
{
  // LCDC
  emu.lcd_enable       = false;
  emu.lcd_wnd_tilemap  = 0x9800;
  emu.lcd_wnd_display  = false;
  emu.lcd_tile_data    = 0x8000;
  emu.lcd_bg_tilemap   = 0x9800;
  emu.lcd_obj_size     = 0x08;
  emu.lcd_obj_display  = false;
  emu.lcd_bg_display   = false;

  // STAT
  emu.lcd_stat_lyc     = false;
  emu.lcd_stat_oam     = false;
  emu.lcd_stat_vblank  = false;
  emu.lcd_stat_hblank  = false;
  emu.lcd_stat_equ     = false;
  emu.lcd_stat_mode    = 0x00;

  // LCD status
  emu.lcd_scx          = 0x00;
  emu.lcd_scy          = 0x00;
  emu.lcd_wy           = 0x00;
  emu.lcd_wx           = 0x00;
  emu.lcd_lx           = 0x00;
  emu.lcd_ly           = 0x00;
  emu.lcd_lyc          = 0x00;
  emu.lcd_vram         = new Uint8Array( 144 * 160 * 4 );

  // Palettes
  emu.lcd_bg           = [ 0x0, 0x0, 0x0, 0x0 ];
  emu.lcd_obp0         = [ 0x0, 0x0, 0x0, 0x0 ];
  emu.lcd_obp1         = [ 0x0, 0x0, 0x0, 0x0 ];

  /**
   * Retrieves a color from a given palette
   */
  function get_color( pal, pix )
  {
    switch ( pal[ pix ] )
    {
      case 0x0: return 0xFF;
      case 0x1: return 0xAA;
      case 0x2: return 0x66;
      case 0x3: return 0x00;
    }
  }

  
  function get_tile_pixel( tile, l, c, base )
  {
    var b0, b1, idx, pix;

    if ( !base )
    {
      base = emu.lcd_tile_data;
    }

    if ( base == 0x9000 && ( tile & 0x80 ) )
    {
      tile |= ~0xFF;
    }

    idx = base + ( tile << 4 ) + ( l << 1 );
    b0 = emu.ram[ idx ];
    b1 = emu.ram[ idx + 1];

    pix = 0x00;
    pix |= ( ( b0 & ( 1 << c ) ) >> c ) << 0;
    pix |= ( ( b1 & ( 1 << c ) ) >> c ) << 1;

    return pix;
  }

  function build_background( vidx, y, x )
  {
    var tile, pix;

    tile = emu.ram[ emu.lcd_bg_tilemap + ( y >> 3 ) * 32 + ( x >> 3 ) ];

    pix = get_tile_pixel( tile, y & 7, 7 - ( x & 7 ) );
    pix = get_color( emu.lcd_bg, pix );

    emu.lcd_vram[ vidx + 0 ] = pix;
    emu.lcd_vram[ vidx + 1 ] = pix;
    emu.lcd_vram[ vidx + 2 ] = pix;
    emu.lcd_vram[ vidx + 3 ] = 0xFF;
  }

  function build_window( vidx, y, x )
  {
    var tile, pix;

    tile = emu.ram[ emu.lcd_wnd_tilemap + ( y >> 3 ) * 32 + ( x >> 3 ) ];
    pix = get_tile_pixel( tile, y & 7, 7 - ( x & 7 ) );
    pix = get_color( emu.lcd_bg, pix );

    emu.lcd_vram[ vidx + 0 ] = pix;
    emu.lcd_vram[ vidx + 1 ] = pix;
    emu.lcd_vram[ vidx + 2 ] = pix;
    emu.lcd_vram[ vidx + 3 ] = 0xFF;
  }

  emu.lcd_scanline = function( )
  {
    var ly = emu.lcd_ly - 1;
    if ( emu.lcd_bg_display )
    {
      var vidx, y;

      vidx = ly * 160 * 4 - 4
      y = emu.lcd_scy + ly;
      for ( var x = emu.lcd_scx; x < emu.lcd_scx + 160; ++x )
      {
        build_background( vidx += 4, y & 0xFF, x & 0xFF );
      }

      if ( emu.lcd_wnd_display && ly >= emu.lcd_wy )
      {
        var xx, yy;
        for ( var x = Math.max( 0, emu.lcd_wx - 7 ); x < 160; ++ x )
        {
          xx = x - emu.lcd_wx + 7;
          yy = ly - emu.lcd_wy;
          build_window( ( ly * 160 + x ) << 2, yy, xx );
        }
      }
    }

    if ( emu.lcd_obj_display )
    {
      var x0, y0, xx, yy, p, f, vidx;

      for ( var i = 39; i >= 0; --i )
      {
        y0 = emu.ram[ 0xFE00 + ( i << 2 ) + 0 ];
        x0 = emu.ram[ 0xFE00 + ( i << 2 ) + 1 ];
        p  = emu.ram[ 0xFE00 + ( i << 2 ) + 2 ];
        f  = emu.ram[ 0xFE00 + ( i << 2 ) + 3 ];

        if ( Math.max( 0, y0 - 16 ) <= ly && ly < Math.min( y0 - 8, 144 ) )
        {
          for (var x = Math.min( x0, 160 ) - 1; x >= Math.max( 0, x0 - 8 ); --x )
          {
            xx = ( f & 0x20 ) ? ( 15 - x + x0 ) : ( x - x0 );
            yy = ( f & 0x40 ) ? ( 7 - ly + y0 ) : ( ly - y0 );
            vidx = ( ly * 160 + x ) << 2;

            if ( !( f & 0x80 ) || emu.lcd_vram[ vidx ] == get_color( emu.lcd_bg, 0x00 ) )
            {
              pix = get_tile_pixel( p, yy & 7, 7 - ( xx & 7 ), 0x8000 );

              if ( pix != 0x00 )
              {
                pix = get_color( f & 0x10 ? emu.lcd_obp1 : emu.lcd_obp0, pix );

                emu.lcd_vram[ vidx + 0 ] = pix;
                emu.lcd_vram[ vidx + 1 ] = pix;
                emu.lcd_vram[ vidx + 2 ] = pix;
                emu.lcd_vram[ vidx + 3 ] = 0xFF;
              }
            }
          }
        }
      }
    }
  }

  emu.lcd_vblank = function( )
  {
    if ( !emu.lcd_enable )
    {
      for ( var i = 0; i < emu.vram.length; ++i )
      {
        emu.vram[ i ] = ( i & 3 ) == 3 ? 0xFF : 0x00;
      }
    }
    else
    {
      for ( var i = 0; i < emu.lcd_vram.length; ++i )
      {
        emu.vram[ i ] = emu.lcd_vram[ i ];
      }
    }
  }
} ) ( this.emu = this.emu || { } );
