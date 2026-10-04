# Pave app icons

Road icon designed by [Slidicon](https://www.flaticon.com/authors/slidicon) from
[Flaticon](https://www.flaticon.com/free-icon/road_3016235).

Used under the [Flaticon License](https://www.flaticon.com/legal), with attribution
displayed in Pave's settings. This is licensed stock artwork, not an exclusive
trademark. Keep the author credit when distributing the extension.

The original PNG was downloaded from
https://cdn-icons-png.flaticon.com/512/3016/3016235.png on 2026-10-04.
The artwork is unchanged; smaller sizes are resized exports with transparency.

`icon16.png`, `icon32.png`, `icon48.png`, and `icon128.png` are wired into the
extension manifest. `icon256.png` and `icon512.png` are larger app assets.

To regenerate the smaller sizes with ImageMagick:

```sh
for size in 16 32 48 128 256; do
  magick icons/icon512.png -resize "${size}x${size}" -strip "PNG32:icons/icon${size}.png"
done
```
