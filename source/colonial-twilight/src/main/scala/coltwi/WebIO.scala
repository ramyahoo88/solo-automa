package coltwi

import scala.collection.mutable.ArrayBuffer
import scala.util.control.ControlThrowable

/** Suspends the console program at its next unanswered input. */
object WebIO {
  final case class Prompt(
    text: String,
    kind: String,
    options: Seq[(String, String)],
    allowEmpty: Boolean,
    bounds: Option[(Int, Int)]
  )
  final case class Line(text: String, style: String)
  case object Waiting extends ControlThrowable

  private val ansi = "\u001b\\[[0-9;]*m".r
  private var inputs = Vector.empty[String]
  private[coltwi] var consumed = 0
  private[coltwi] var prompt = Option.empty[Prompt]
  private[coltwi] val lines = ArrayBuffer.empty[Line]
  private[coltwi] var onTurnSaved: () => Unit = () => ()

  private[coltwi] def begin(responses: Vector[String]): Unit = {
    inputs = responses
    consumed = 0
    prompt = None
    lines.clear()
  }

  def println(): Unit = println("")
  def println(value: Any): Unit = {
    val raw = String.valueOf(value)
    val color = ansi.findFirstIn(raw).getOrElse("")
    val style = color match {
      case Console.RED     => "event"
      case Console.CYAN    => "piece"
      case Console.BLUE    => "piece"
      case Console.GREEN   => "info"
      case Console.YELLOW  => "marker"
      case Console.MAGENTA => "marker"
      case _               => "plain"
    }
    lines += Line(ansi.replaceAllIn(raw, ""), style)
  }

  def readLine(
    text: String,
    kind: String = "text",
    options: Seq[(String, String)] = Nil,
    allowEmpty: Boolean = false,
    bounds: Option[(Int, Int)] = None
  ): String = {
    if (consumed == inputs.length) {
      prompt = Some(Prompt(ansi.replaceAllIn(text, "").trim, kind, options, allowEmpty, bounds))
      throw Waiting
    }
    val response = inputs(consumed)
    consumed += 1
    response
  }

  def turnSaved(): Unit = onTurnSaved()
}

/** java.util.Random's 48-bit generator with explicit checkpoint/restore. */
object WebRandom {
  private val multiplier = 0x5deece66dL
  private val mask = (1L << 48) - 1
  private var state = 0L
  private val generator = new java.util.Random(0L) {
    override protected def next(bits: Int): Int = {
      state = (state * multiplier + 11) & mask
      (state >>> (48 - bits)).toInt
    }
  }
  private val random = new scala.util.Random(generator)

  def seed(value: Long): Unit = state = (value ^ multiplier) & mask
  def snapshot: Long = state
  def restore(value: Long): Unit = state = value
  def nextInt(bound: Int): Int = random.nextInt(bound)
  def shuffle[T, C[X] <: IterableOnce[X]](values: C[T])(
    implicit buildFrom: scala.collection.BuildFrom[C[T], T, C[T]]
  ): C[T] = random.shuffle(values)
}
